/**
 * lekh — database schema
 *
 * Content model notes:
 *  - A story is owned by one author and may have co-authors (story_editors).
 *  - Stories contain parts (optional grouping) which contain chapters.
 *  - A chapter's text is stored twice:
 *      * `chapters.content`  -> denormalised ProseMirror doc (fast reads)
 *      * `chapter_blocks`    -> one row per block/paragraph (source of truth for
 *                               realtime merges, inline comment anchoring)
 *  - Blocks have a stable id so comments and live cursors survive edits.
 */

import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ *
 * Editor document types (TipTap / ProseMirror JSON)
 * ------------------------------------------------------------------ */

export type InlineMark = {
  type: "bold" | "italic" | "underline" | "strike" | "code" | "link" | "highlight";
  attrs?: Record<string, unknown>;
};

export type InlineNode = {
  type: "text";
  text: string;
  marks?: InlineMark[];
};

export type BlockNode = {
  type: "paragraph" | "heading" | "blockquote" | "hr" | "image";
  attrs?: {
    id?: string;
    level?: 1 | 2 | 3;
    src?: string;
    alt?: string;
    [key: string]: unknown;
  };
  content?: InlineNode[];
};

export type EditorDoc = {
  type: "doc";
  content: BlockNode[];
};

export type BlockKind = "paragraph" | "heading" | "blockquote" | "hr" | "image";

/* ------------------------------------------------------------------ *
 * Profiles
 * ------------------------------------------------------------------ */

export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey(),
    username: text("username").notNull(),
    displayName: text("display_name").notNull(),
    bio: text("bio").notNull().default(""),
    avatarKey: text("avatar_key"),
    role: text("role").notNull().default("user"), // 'user' | 'admin'
    language: text("language").notNull().default("en"),
    website: text("website"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("profiles_username_idx").on(t.username)],
);

export type Profile = typeof profiles.$inferSelect;

/* ------------------------------------------------------------------ *
 * Stories
 * ------------------------------------------------------------------ */

export const stories = pgTable(
  "stories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    authorId: uuid("author_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    description: text("description").notNull().default(""),
    language: text("language").notNull().default("en"),
    visibility: text("visibility").notNull().default("public"), // public | unlisted | private
    status: text("status").notNull().default("draft"), // draft | published
    coverKey: text("cover_key"),
    coverColor: text("cover_color"),
    tags: text("tags").array().notNull().default(sql`ARRAY[]::text[]`),
    contentWarnings: text("content_warnings").array().notNull().default(sql`ARRAY[]::text[]`),
    fontPreset: text("font_preset").notNull().default("literary"),
    isCompleted: boolean("is_completed").notNull().default(false),
    featured: boolean("featured").notNull().default(false),
    wordCount: integer("word_count").notNull().default(0),
    chapterCount: integer("chapter_count").notNull().default(0),
    readCount: integer("read_count").notNull().default(0),
    commentCount: integer("comment_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (t) => [
    index("stories_author_idx").on(t.authorId),
    index("stories_visibility_status_idx").on(t.visibility, t.status),
    index("stories_published_idx").on(t.publishedAt),
    index("stories_tags_idx").using("gin", t.tags),
    uniqueIndex("stories_author_slug_idx").on(t.authorId, t.slug),
  ],
);

export type Story = typeof stories.$inferSelect;

export const storyEditors = pgTable(
  "story_editors",
  {
    storyId: uuid("story_id")
      .notNull()
      .references(() => stories.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.storyId, t.userId] })],
);

/* ------------------------------------------------------------------ *
 * Parts & chapters
 * ------------------------------------------------------------------ */

export const parts = pgTable(
  "parts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storyId: uuid("story_id")
      .notNull()
      .references(() => stories.id, { onDelete: "cascade" }),
    title: text("title").notNull().default(""),
    position: integer("position").notNull().default(0),
    thumbnailKey: text("thumbnail_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("parts_story_idx").on(t.storyId, t.position)],
);

export type Part = typeof parts.$inferSelect;

export const chapters = pgTable(
  "chapters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storyId: uuid("story_id")
      .notNull()
      .references(() => stories.id, { onDelete: "cascade" }),
    partId: uuid("part_id").references(() => parts.id, { onDelete: "set null" }),
    title: text("title").notNull().default(""),
    position: integer("position").notNull().default(0),
    content: jsonb("content").$type<EditorDoc>().notNull().default({ type: "doc", content: [] }),
    plainText: text("plain_text").notNull().default(""),
    wordCount: integer("word_count").notNull().default(0),
    thumbnailKey: text("thumbnail_key"),
    isLocked: boolean("is_locked").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("chapters_story_idx").on(t.storyId, t.position),
    index("chapters_part_idx").on(t.partId),
  ],
);

export type Chapter = typeof chapters.$inferSelect;

export const chapterBlocks = pgTable(
  "chapter_blocks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    chapterId: uuid("chapter_id")
      .notNull()
      .references(() => chapters.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    kind: text("kind").notNull().default("paragraph"),
    content: jsonb("content").$type<InlineNode[]>().notNull().default([]),
    plainText: text("plain_text").notNull().default(""),
    deleted: boolean("deleted").notNull().default(false),
    authorId: uuid("author_id").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("chapter_blocks_chapter_idx").on(t.chapterId, t.position),
    index("chapter_blocks_updated_idx").on(t.updatedAt),
  ],
);

export type ChapterBlock = typeof chapterBlocks.$inferSelect;

/* ------------------------------------------------------------------ *
 * Live editing presence (co-writing cursors)
 * ------------------------------------------------------------------ */

export const editorPresence = pgTable(
  "editor_presence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    chapterId: uuid("chapter_id")
      .notNull()
      .references(() => chapters.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    blockId: uuid("block_id"),
    offset: integer("offset").notNull().default(0),
    active: boolean("active").notNull().default(true),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("editor_presence_chapter_idx").on(t.chapterId),
    uniqueIndex("editor_presence_user_chapter_idx").on(t.chapterId, t.userId),
  ],
);

/* ------------------------------------------------------------------ *
 * Reading activity & social graph
 * ------------------------------------------------------------------ */

export const storyReads = pgTable(
  "story_reads",
  {
    storyId: uuid("story_id")
      .notNull()
      .references(() => stories.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => profiles.id, { onDelete: "cascade" }),
    readCount: integer("read_count").notNull().default(1),
    lastReadAt: timestamp("last_read_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.storyId, t.userId] })],
);

export const storyReadEvents = pgTable(
  "story_read_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storyId: uuid("story_id")
      .notNull()
      .references(() => stories.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => profiles.id, { onDelete: "set null" }),
    chapterId: uuid("chapter_id").references(() => chapters.id, { onDelete: "set null" }),
    day: text("day").notNull(), // YYYY-MM-DD
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("story_read_events_day_idx").on(t.day), index("story_read_events_story_idx").on(t.storyId)],
);

export const readingProgress = pgTable(
  "reading_progress",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    chapterId: uuid("chapter_id")
      .notNull()
      .references(() => chapters.id, { onDelete: "cascade" }),
    percent: integer("percent").notNull().default(0),
    position: integer("position").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.chapterId] })],
);

export const follows = pgTable(
  "follows",
  {
    followerId: uuid("follower_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.followerId, t.authorId] })],
);

export const favorites = pgTable(
  "favorites",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    storyId: uuid("story_id")
      .notNull()
      .references(() => stories.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.storyId] })],
);

/* ------------------------------------------------------------------ *
 * Comments (story wall / chapter thread / inline on a block)
 * ------------------------------------------------------------------ */

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storyId: uuid("story_id")
      .notNull()
      .references(() => stories.id, { onDelete: "cascade" }),
    chapterId: uuid("chapter_id").references(() => chapters.id, { onDelete: "cascade" }),
    blockId: uuid("block_id"),
    quotedText: text("quoted_text"),
    authorId: uuid("author_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id"),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("comments_story_idx").on(t.storyId, t.createdAt),
    index("comments_chapter_idx").on(t.chapterId, t.createdAt),
    index("comments_block_idx").on(t.blockId),
    index("comments_parent_idx").on(t.parentId),
  ],
);

export type Comment = typeof comments.$inferSelect;

export const commentReports = pgTable(
  "comment_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    commentId: uuid("comment_id")
      .notNull()
      .references(() => comments.id, { onDelete: "cascade" }),
    reporterId: uuid("reporter_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    reason: text("reason").notNull().default(""),
    status: text("status").notNull().default("open"), // open | resolved | dismissed
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("comment_reports_status_idx").on(t.status)],
);

/* ------------------------------------------------------------------ *
 * MCP tokens
 * ------------------------------------------------------------------ */

export const mcpTokens = pgTable(
  "mcp_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    name: text("name").notNull().default("mcp key"),
    tokenHash: text("token_hash").notNull(),
    scopes: text("scopes").notNull().default("read"),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("mcp_tokens_hash_idx").on(t.tokenHash)],
);

/* ------------------------------------------------------------------ *
 * Admin settings & audit log
 * ------------------------------------------------------------------ */

export const adminSettings = pgTable("admin_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id").references(() => profiles.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    meta: jsonb("meta").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_log_created_idx").on(t.createdAt)],
);

/* ------------------------------------------------------------------ *
 * OCR jobs (image -> text)
 * ------------------------------------------------------------------ */

export const ocrJobs = pgTable(
  "ocr_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    storyId: uuid("story_id").references(() => stories.id, { onDelete: "set null" }),
    chapterId: uuid("chapter_id").references(() => chapters.id, { onDelete: "set null" }),
    status: text("status").notNull().default("pending"), // pending | running | review | done | failed
    provider: text("provider"),
    model: text("model"),
    language: text("language").notNull().default("auto"),
    images: jsonb("images").$type<{ key: string; url: string; name: string }[]>().notNull().default([]),
    results: jsonb("results").$type<OcrImageResult[]>().notNull().default([]),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ocr_jobs_user_idx").on(t.userId, t.createdAt)],
);

export type OcrImageResult = {
  imageKey: string;
  status: "pending" | "processing" | "done" | "error";
  text?: string;
  blocks?: BlockNode[];
  error?: string;
  editedText?: string;
  confidence?: number;
};

export type AdminSettings = {
  vision?: {
    provider: "openai" | "anthropic" | "gemini" | "openai-compatible" | "none";
    baseUrl?: string;
    apiKey?: string;
    model: string;
    prompt?: string;
    temperature?: number;
  };
  site?: {
    name: string;
    tagline: string;
    announcement?: string;
    announcementEnabled?: boolean;
    defaultLanguage?: string;
    languages?: string[];
  };
  features?: {
    ocr?: boolean;
    realtime?: boolean;
    comments?: boolean;
    signupOpen?: boolean;
  };
  moderation?: {
    allowUnmoderatedUploads?: boolean;
    blockedWords?: string[];
  };
};
