"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BubbleMenu, EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import Image from "@tiptap/extension-image";
import { toast } from "sonner";

import { BlockId } from "@/lib/tiptap/block-id";
import { writerFontStack } from "@/lib/fonts";
import { docToEditorBlocks, editorBlocksToDoc } from "@/lib/writer/blocks";
import type { EditorBlock } from "@/lib/writer/blocks";
import type { EditorDoc } from "@lekh/db";

import { EditorToolbar } from "./editor-toolbar";
import { SaveStatus, type SaveState } from "./save-status";

type PresenceRow = {
  userId: string;
  blockId: string | null;
  offset: number;
  displayName: string;
  username: string;
  avatarKey: string | null;
};

export type WriterEditorProps = {
  chapterId: string;
  initialContent: EditorDoc;
  initialTitle: string;
  initialBlocks?: EditorBlock[];
  initialUpdatedAt?: string | null;
  fontPreset?: string;
  onWordsChange?: (words: number) => void;
  onFontPresetChange?: (preset: string) => void;
  onRequestOcr?: () => void;
};

const DRAFT_PREFIX = "lekh.draft.";

export function WriterEditor({
  chapterId,
  initialContent,
  initialTitle,
  initialUpdatedAt,
  fontPreset = "literary",
  onWordsChange,
  onFontPresetChange,
  onRequestOcr,
}: WriterEditorProps) {
  const [title, setTitle] = useState(initialTitle);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [others, setOthers] = useState<PresenceRow[]>([]);
  const [recovery, setRecovery] = useState<{ content: EditorDoc; title: string; at: number } | null>(null);

  const titleRef = useRef(initialTitle);
  const dirtyRef = useRef(false);
  const lastSyncedRef = useRef<string | null>(initialUpdatedAt ?? null);
  const savingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false,
        horizontalRule: {},
        dropcursor: { color: "rgba(180,85,45,0.35)", width: 2 },
      }),
      Underline,
      Highlight.configure({ multicolor: false }),
      Link.configure({ openOnClick: false, autolink: true, linkOnPaste: true }),
      Placeholder.configure({
        placeholder: "Start writing… the words will save themselves.",
      }),
      CharacterCount,
      Image.configure({ inline: false, allowBase64: false }),
      BlockId,
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class:
          "prose-none focus:outline-none min-h-[55vh] text-[1.0625rem] leading-[1.75] px-5 py-4 md:text-lg md:px-10",
        spellcheck: "true",
        autocapitalize: "sentences",
      },
    },
    onUpdate: () => {
      dirtyRef.current = true;
      setSaveState("dirty");
      scheduleSave();
      backupLocally();
    },
    onSelectionUpdate: () => {
      void pushPresence();
    },
  });

  /* ---------------------------------------------------------------- *
   * Autosave
   * ---------------------------------------------------------------- */

  const buildPayload = useCallback(() => {
    if (!editor) return null;
    const content = editor.getJSON() as EditorDoc;
    const blocks = docToEditorBlocks(content).map((block) => ({
      ...block,
      updatedAt: new Date().toISOString(),
    }));
    return { title: titleRef.current, content, blocks };
  }, [editor]);

  const save = useCallback(async () => {
    if (!editor || savingRef.current) return;
    const payload = buildPayload();
    if (!payload) return;
    savingRef.current = true;
    setSaveState("saving");
    try {
      const res = await fetch(`/api/chapters/${chapterId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`save failed: ${res.status}`);
      dirtyRef.current = false;
      setSaveState("saved");
      setSavedAt(new Date());
      lastSyncedRef.current = new Date().toISOString();
      try {
        window.localStorage.removeItem(`${DRAFT_PREFIX}${chapterId}`);
      } catch {
        /* ignore */
      }
    } catch {
      setSaveState("error");
    } finally {
      savingRef.current = false;
    }
  }, [buildPayload, chapterId, editor]);

  const scheduleSave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void save();
    }, 700);
  }, [save]);

  const backupLocally = useCallback(() => {
    if (!editor) return;
    try {
      const content = editor.getJSON() as EditorDoc;
      window.localStorage.setItem(
        `${DRAFT_PREFIX}${chapterId}`,
        JSON.stringify({ content, title: titleRef.current, at: Date.now() }),
      );
    } catch {
      /* storage full — ignore */
    }
  }, [chapterId, editor]);

  // Flush pending changes when leaving the page.
  useEffect(() => {
    const flush = () => {
      if (dirtyRef.current && !savingRef.current) void save();
    };
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flush();
    });
    return () => {
      window.removeEventListener("beforeunload", flush);
    };
  }, [save]);

  // Offer to restore an unsynced local draft.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(`${DRAFT_PREFIX}${chapterId}`);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { content: EditorDoc; title: string; at: number };
      const serverAt = initialUpdatedAt ? Date.parse(initialUpdatedAt) : 0;
      if (parsed.at > serverAt) setRecovery(parsed);
    } catch {
      /* ignore */
    }
  }, [chapterId, initialUpdatedAt]);

  /* ---------------------------------------------------------------- *
   * Presence + remote sync
   * ---------------------------------------------------------------- */

  const pushPresence = useCallback(async () => {
    if (!editor) return;
    try {
      const { from } = editor.state.selection;
      let blockId: string | null = null;
      let offset = 0;
      editor.state.doc.nodesBetween(from, from, (node, pos) => {
        if (blockId === null && (node.type.name === "paragraph" || node.type.name === "heading")) {
          blockId = (node.attrs.id as string | undefined) ?? null;
          offset = Math.max(0, from - pos);
        }
      });
      await fetch("/api/presence", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chapterId, blockId, offset }),
      });
    } catch {
      /* presence is best effort */
    }
  }, [chapterId, editor]);

  useEffect(() => {
    if (!editor) return;
    let cancelled = false;

    const pollPresence = async () => {
      try {
        const res = await fetch(`/api/presence?chapterId=${chapterId}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { presence: PresenceRow[] };
        if (cancelled) return;
        setOthers(data.presence ?? []);
      } catch {
        /* ignore */
      }
    };

    const pollRemote = async () => {
      if (dirtyRef.current || savingRef.current) return;
      try {
        const res = await fetch(`/api/chapters/${chapterId}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as {
          chapter: { updatedAt: string };
          blocks: { id: string; kind: string; content: unknown; plainText: string; updatedAt: string }[];
        };
        if (cancelled) return;
        const remoteAt = Date.parse(data.chapter.updatedAt);
        if (!data.chapter.updatedAt || remoteAt <= Date.parse(lastSyncedRef.current ?? "")) return;
        const blocks: EditorBlock[] = data.blocks.map((b) => ({
          type: b.kind as EditorBlock["type"],
          attrs: { id: b.id },
          content: (b.content ?? []) as EditorBlock["content"],
          plainText: b.plainText,
          updatedAt: b.updatedAt,
        }));
        if (blocks.length) {
          editor.commands.setContent(editorBlocksToDoc(blocks) as EditorDoc);
          lastSyncedRef.current = data.chapter.updatedAt;
          setSavedAt(new Date());
        }
      } catch {
        /* ignore */
      }
    };

    void pollPresence();
    const presenceTimer = setInterval(pollPresence, 4000);
    const remoteTimer = setInterval(pollRemote, 6000);
    const presenceBeat = setInterval(() => void pushPresence(), 8000);

    return () => {
      cancelled = true;
      clearInterval(presenceTimer);
      clearInterval(remoteTimer);
      clearInterval(presenceBeat);
    };
  }, [chapterId, editor, pushPresence]);

  /* ---------------------------------------------------------------- *
   * Derived
   * ---------------------------------------------------------------- */

  const words = useMemo(() => {
    if (!editor) return 0;
    return editor.storage.characterCount.words() as number;
  }, [editor, saveState]);

  useEffect(() => {
    onWordsChange?.(words);
  }, [onWordsChange, words]);

  const fontStack = writerFontStack(fontPreset);

  return (
    <div className="relative flex min-h-[calc(100dvh-3.5rem)] flex-col">
      {/* Sticky editor header */}
      <div className="sticky top-14 z-30 border-b bg-background/95 backdrop-blur">
        <input
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            titleRef.current = event.target.value;
            dirtyRef.current = true;
            setSaveState("dirty");
            scheduleSave();
          }}
          placeholder="Chapter title"
          className="h-11 w-full bg-transparent px-4 text-base font-semibold outline-none placeholder:text-muted-foreground md:px-10 md:text-lg"
          aria-label="Chapter title"
        />
        <div className="flex items-center gap-3 px-4 pb-2 md:px-10">
          <SaveStatus state={saveState} savedAt={savedAt} />
          <span className="text-xs text-muted-foreground">{words.toLocaleString()} words</span>
          {others.length > 0 && (
            <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
              <span className="flex -space-x-1.5">
                {others.slice(0, 3).map((row) => (
                  <span
                    key={row.userId}
                    title={`${row.displayName} is writing`}
                    className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-[10px] font-medium text-primary ring-2 ring-background"
                  >
                    {row.displayName.slice(0, 1).toUpperCase()}
                  </span>
                ))}
              </span>
              {others.length === 1 ? "1 person editing" : `${others.length} people editing`}
            </span>
          )}
        </div>
      </div>

      {recovery && (
        <div className="mx-4 mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-sm md:mx-10">
          <span className="flex-1">We found unsaved changes from this device.</span>
          <button
            type="button"
            className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground"
            onClick={() => {
              editor?.commands.setContent(recovery.content as EditorDoc);
              setTitle(recovery.title);
              titleRef.current = recovery.title;
              setRecovery(null);
              dirtyRef.current = true;
              scheduleSave();
            }}
          >
            Restore
          </button>
          <button
            type="button"
            className="rounded-md border px-2.5 py-1 text-xs"
            onClick={() => {
              try {
                window.localStorage.removeItem(`${DRAFT_PREFIX}${chapterId}`);
              } catch {
                /* ignore */
              }
              setRecovery(null);
            }}
          >
            Discard
          </button>
        </div>
      )}

      <div className="flex-1" style={{ fontFamily: fontStack }}>
        <EditorContent editor={editor} />
      </div>

      {editor && (
        <BubbleMenu
          editor={editor}
          tippyOptions={{ duration: 120, placement: "top" }}
          shouldShow={({ editor: e, from, to }) => from !== to && !e.isActive("codeBlock")}
          className="flex items-center gap-1 rounded-lg border bg-popover p-1 shadow-lg"
        >
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`rounded px-2 py-1 text-sm font-bold ${editor.isActive("bold") ? "bg-accent" : ""}`}
          >
            B
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`rounded px-2 py-1 text-sm italic ${editor.isActive("italic") ? "bg-accent" : ""}`}
          >
            I
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={`rounded px-2 py-1 text-sm underline ${editor.isActive("underline") ? "bg-accent" : ""}`}
          >
            U
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHighlight().run()}
            className={`rounded px-2 py-1 text-xs ${editor.isActive("highlight") ? "bg-accent" : ""}`}
          >
            mark
          </button>
        </BubbleMenu>
      )}

      <EditorToolbar
        editor={editor}
        fontPreset={fontPreset}
        onFontPresetChange={(preset) => {
          onFontPresetChange?.(preset);
          toast.success("Book font updated");
        }}
        onRequestOcr={onRequestOcr}
        onSave={() => void save()}
      />
    </div>
  );
}
