import type { EditorDoc } from "@lekh/db";

/** Story fields the reader needs. */
export type ReaderStoryMeta = {
  id: string;
  slug: string;
  title: string;
  description: string;
  language: string;
  authorName: string;
  authorUsername: string;
  coverKey: string | null;
  coverColor: string | null;
};

/** Chapter listing entry (no content). */
export type ReaderChapterMeta = {
  id: string;
  partId: string | null;
  title: string;
  position: number;
  wordCount: number;
  isLocked: boolean;
};

export type ReaderPartMeta = {
  id: string;
  title: string;
  position: number;
};

/** The chapter being read, including its ProseMirror document. */
export type ReaderChapterDoc = {
  id: string;
  title: string;
  position: number;
  wordCount: number;
  content: EditorDoc | null;
};

export type ReaderProps = {
  story: ReaderStoryMeta;
  chapter: ReaderChapterDoc;
  chapters: ReaderChapterMeta[];
  parts: ReaderPartMeta[];
  /** True when the viewer may not read this chapter yet. */
  locked?: boolean;
  /**
   * Optional hook for the comments layer. When omitted (or in addition to it)
   * the reader dispatches a `lekh:comment-request` window event.
   */
  onSelectText?: (blockId: string, quote: string) => void;
  /** Optional hook for the comments layer; also dispatches `lekh:comments-open`. */
  onOpenComments?: (chapterId: string) => void;
};

/** A pending "comment on this text" request. */
export type SelectionTarget = {
  blockId: string;
  quote: string;
  x: number;
  y: number;
};
