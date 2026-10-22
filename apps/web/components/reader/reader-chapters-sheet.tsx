"use client";

import * as React from "react";
import { Check, Lock } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { ReaderTheme } from "@/lib/fonts";

import type { ReaderChapterMeta, ReaderPartMeta } from "./types";

export type ReaderChaptersSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chapters: ReaderChapterMeta[];
  parts: ReaderPartMeta[];
  currentChapterId: string;
  onSelect: (chapterId: string) => void;
  theme: ReaderTheme;
};

type Group = { id: string; title: string | null; chapters: ReaderChapterMeta[] };

function groupChapters(
  chapters: ReaderChapterMeta[],
  parts: ReaderPartMeta[],
): Group[] {
  const ordered = [...chapters].sort((a, b) => a.position - b.position);
  const partIds = new Set(parts.map((part) => part.id));
  const groups: Group[] = [];

  if (parts.length > 0) {
    for (const part of [...parts].sort((a, b) => a.position - b.position)) {
      groups.push({
        id: part.id,
        title: part.title || "Part",
        chapters: ordered.filter((chapter) => chapter.partId === part.id),
      });
    }
    const loose = ordered.filter(
      (chapter) => !chapter.partId || !partIds.has(chapter.partId),
    );
    if (loose.length > 0) {
      groups.push({ id: "loose", title: "Chapters", chapters: loose });
    }
    return groups;
  }

  groups.push({ id: "all", title: null, chapters: ordered });
  return groups;
}

export function ReaderChaptersSheet({
  open,
  onOpenChange,
  chapters,
  parts,
  currentChapterId,
  onSelect,
  theme,
}: ReaderChaptersSheetProps) {
  const [desktop, setDesktop] = React.useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const groups = React.useMemo(() => groupChapters(chapters, parts), [chapters, parts]);
  const currentIndex = React.useMemo(
    () => chapters.findIndex((chapter) => chapter.id === currentChapterId),
    [chapters, currentChapterId],
  );
  const readCount = Math.max(0, currentIndex);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={desktop ? "right" : "bottom"}
        data-theme={theme}
        className={cn(
          "reader-root gap-0 p-0",
          theme === "night" || theme === "midnight" ? "dark" : "",
          desktop ? "w-full max-w-sm" : "max-h-[85dvh] rounded-t-3xl",
        )}
        style={{ background: "var(--reader-bg)", color: "var(--reader-fg)" }}
      >
        <SheetHeader className="px-5 pt-5">
          <SheetTitle className="font-serif text-lg">Chapters</SheetTitle>
          <SheetDescription className="text-xs opacity-60">
            {chapters.length} chapters · {readCount > 0 ? `${readCount} read` : "not started yet"}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex-1 space-y-6 overflow-y-auto px-5 pb-8">
          {groups.map((group) => (
            <section key={group.id} className="space-y-1.5">
              {group.title ? (
                <h3 className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-[0.14em] opacity-50">
                  {group.title}
                </h3>
              ) : null}
              <ul className="space-y-1">
                {group.chapters.map((chapter) => {
                  const index = chapters.findIndex((c) => c.id === chapter.id);
                  const current = chapter.id === currentChapterId;
                  const read = index >= 0 && index < currentIndex;
                  return (
                    <li key={chapter.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onSelect(chapter.id);
                          onOpenChange(false);
                        }}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                          current ? "font-semibold" : "opacity-80",
                        )}
                        style={{
                          background: current
                            ? "color-mix(in srgb, var(--reader-accent) 14%, transparent)"
                            : "transparent",
                          boxShadow: current ? "inset 0 0 0 1px var(--reader-accent)" : undefined,
                        }}
                      >
                        <span className="w-6 shrink-0 text-xs tabular-nums opacity-45">
                          {index + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm">{chapter.title}</span>
                        {chapter.isLocked ? <Lock className="h-3.5 w-3.5 shrink-0 opacity-45" /> : null}
                        {read ? <Check className="h-3.5 w-3.5 shrink-0 opacity-45" /> : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
