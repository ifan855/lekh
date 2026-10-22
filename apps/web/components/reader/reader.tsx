"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  List,
  MessageSquare,
  Type as TypeIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { readerFont } from "@/lib/fonts";
import { isRtl } from "@/lib/languages";

import { ReaderChaptersSheet } from "./reader-chapters-sheet";
import { ReaderContent, type ReaderTypography } from "./reader-content";
import { ReaderPages } from "./reader-pages";
import { ReaderSelectionToolbar } from "./reader-selection-toolbar";
import { ReaderSettingsSheet } from "./reader-settings-sheet";
import { useDimmer } from "./reader-prefs";
import { useReaderSettings } from "./use-reader-settings";
import type { ReaderProps, SelectionTarget } from "./types";

const LONG_PRESS_MS = 480;
const EDGE_RATIO = 0.2;

function findBlockId(node: Node | null): string | null {
  if (!node) return null;
  const element = node instanceof HTMLElement ? node : node.parentElement;
  if (!element) return null;
  const block = element.closest("[data-block-id]") as HTMLElement | null;
  return block?.dataset.blockId ?? null;
}

export function Reader({
  story,
  chapter,
  chapters,
  parts,
  locked = false,
  onSelectText,
  onOpenComments,
}: ReaderProps) {
  const router = useRouter();
  const { settings, update } = useReaderSettings();
  const { dim, setDim } = useDimmer();

  const [immersiveChrome, setImmersiveChrome] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [chaptersOpen, setChaptersOpen] = React.useState(false);
  const [selection, setSelection] = React.useState<SelectionTarget | null>(null);
  const [fullscreen, setFullscreen] = React.useState(false);
  const [pageInfo, setPageInfo] = React.useState({ page: 0, pages: 1 });

  const progressRef = React.useRef(0);
  const [progress, setProgress] = React.useState(0);
  const rafRef = React.useRef<number | null>(null);

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const mainRef = React.useRef<HTMLDivElement>(null);
  const measureRef = React.useRef<HTMLSpanElement>(null);
  const longPressRef = React.useRef<number | null>(null);
  const swipedRef = React.useRef(false);
  const touchRef = React.useRef<{ x: number; y: number } | null>(null);

  const rtl = isRtl(story.language);
  const font = readerFont(settings.font);
  const showChrome = settings.immersive ? immersiveChrome : true;

  const typography: ReaderTypography = React.useMemo(
    () => ({
      fontFamily: font.stack,
      fontSize: settings.fontSize,
      lineHeight: settings.lineHeight,
      justify: settings.justify,
      paragraphSpacing: settings.paragraphSpacing,
    }),
    [font.stack, settings.fontSize, settings.lineHeight, settings.justify, settings.paragraphSpacing],
  );

  /* ------------------------------------------------------------- chapters */
  const ordered = React.useMemo(
    () => [...chapters].sort((a, b) => a.position - b.position),
    [chapters],
  );
  const chapterIndex = Math.max(
    0,
    ordered.findIndex((item) => item.id === chapter.id),
  );
  const prevChapter = chapterIndex > 0 ? ordered[chapterIndex - 1] : null;
  const nextChapter = chapterIndex < ordered.length - 1 ? ordered[chapterIndex + 1] : null;
  const storyProgress = ordered.length
    ? Math.min(1, (chapterIndex + progressRef.current) / ordered.length)
    : 0;

  const goToChapter = React.useCallback(
    (chapterId: string) => {
      if (chapterId === chapter.id) return;
      router.push(`/read/${story.id}/${chapterId}`);
    },
    [chapter.id, router, story.id],
  );

  /* ------------------------------------------------------------- measure */
  const [chWidth, setChWidth] = React.useState(8);
  React.useEffect(() => {
    const element = measureRef.current;
    if (!element) return;
    const width = element.getBoundingClientRect().width;
    if (width > 0) setChWidth(width);
  }, [font.stack, settings.fontSize]);
  const contentWidth = Math.round(settings.measure * chWidth);

  /* ---------------------------------------------------------- immersive */
  React.useEffect(() => {
    setImmersiveChrome(!settings.immersive);
  }, [settings.immersive]);

  /* -------------------------------------------------------- body scroll */
  React.useEffect(() => {
    const { body } = document;
    const previous = body.style.overflow;
    body.style.overflow = "hidden";
    return () => {
      body.style.overflow = previous;
    };
  }, []);

  /* ------------------------------------------------------- fullscreen */
  React.useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = React.useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      /* not supported / denied */
    }
  }, []);

  /* ------------------------------------------------------------ progress */
  const setProgressValue = React.useCallback((value: number) => {
    progressRef.current = value;
    if (rafRef.current !== null) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      setProgress(progressRef.current);
    });
  }, []);

  React.useEffect(
    () => () => {
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  const handleScroll = React.useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    const max = element.scrollHeight - element.clientHeight;
    setProgressValue(max > 4 ? Math.min(1, Math.max(0, element.scrollTop / max)) : 1);
  }, [setProgressValue]);

  /* ------------------------------------------------------------ comments */
  const requestComment = React.useCallback(
    (blockId: string, quote: string) => {
      onSelectText?.(blockId, quote);
      window.dispatchEvent(
        new CustomEvent("lekh:comment-request", { detail: { blockId, quote } }),
      );
      setSelection(null);
      const sel = window.getSelection();
      if (sel) sel.removeAllRanges();
    },
    [onSelectText],
  );

  const openComments = React.useCallback(() => {
    onOpenComments?.(chapter.id);
    window.dispatchEvent(
      new CustomEvent("lekh:comments-open", { detail: { scope: "chapter", chapterId: chapter.id } }),
    );
  }, [chapter.id, onOpenComments]);

  /* ---------------------------------------------------------- selection */
  const selectionFromNative = React.useCallback((): SelectionTarget | null => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
    const quote = sel.toString().trim();
    if (!quote) return null;
    const blockId = findBlockId(sel.anchorNode);
    if (!blockId) return null;
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    return {
      blockId,
      quote,
      x: rect.left + rect.width / 2,
      y: rect.top > 8 ? rect.top : rect.bottom + 8,
    };
  }, []);

  const openPointerDown = React.useCallback(
    (event: React.PointerEvent) => {
      touchRef.current = { x: event.clientX, y: event.clientY };
      swipedRef.current = false;
      if (longPressRef.current) window.clearTimeout(longPressRef.current);
      const target = event.target as HTMLElement;
      longPressRef.current = window.setTimeout(() => {
        longPressRef.current = null;
        const block = target.closest("[data-block-id]") as HTMLElement | null;
        if (!block) return;
        const native = selectionFromNative();
        if (native) {
          setSelection(native);
          return;
        }
        const rect = block.getBoundingClientRect();
        setSelection({
          blockId: block.dataset.blockId ?? "",
          quote: (block.textContent ?? "").trim(),
          x: rect.left + rect.width / 2,
          y: rect.top,
        });
      }, LONG_PRESS_MS);
    },
    [selectionFromNative],
  );

  const openPointerUp = React.useCallback(() => {
    if (longPressRef.current) {
      window.clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  }, []);

  const handleClick = React.useCallback(
    (event: React.MouseEvent) => {
      if (swipedRef.current) {
        swipedRef.current = false;
        return;
      }
      const target = event.target as HTMLElement;
      // Links keep their normal behaviour.
      if (target.closest("a")) return;
      const rect = mainRef.current?.getBoundingClientRect();
      const ratio = rect && rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0.5;

      const native = selectionFromNative();
      if (native) {
        setSelection(native);
        return;
      }

      if (settings.immersive) {
        if (ratio < EDGE_RATIO) {
          if (prevChapter) goToChapter(prevChapter.id);
          return;
        }
        if (ratio > 1 - EDGE_RATIO) {
          if (nextChapter) goToChapter(nextChapter.id);
          return;
        }
        setImmersiveChrome((value) => !value);
        return;
      }

      const block = target.closest("[data-block-id]") as HTMLElement | null;
      if (block) {
        const blockRect = block.getBoundingClientRect();
        setSelection({
          blockId: block.dataset.blockId ?? "",
          quote: (block.textContent ?? "").trim(),
          x: blockRect.left + blockRect.width / 2,
          y: blockRect.top,
        });
      }
    },
    [selectionFromNative, settings.immersive, prevChapter, nextChapter, goToChapter],
  );

  const handleContextMenu = React.useCallback(
    (event: React.MouseEvent) => {
      const native = selectionFromNative();
      if (!native) return;
      event.preventDefault();
      setSelection(native);
    },
    [selectionFromNative],
  );

  const handleTouchStart = React.useCallback((event: React.TouchEvent) => {
    const touch = event.touches[0];
    if (touch) touchRef.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const handleTouchEnd = React.useCallback((event: React.TouchEvent) => {
    const start = touchRef.current;
    touchRef.current = null;
    const touch = event.changedTouches[0];
    if (!start || !touch) return;
    const dx = Math.abs(start.x - touch.clientX);
    const dy = Math.abs(start.y - touch.clientY);
    if (dx > 48 && dx > dy) swipedRef.current = true;
  }, []);

  const handlePageChange = React.useCallback((page: number, pages: number) => {
    setPageInfo({ page, pages });
  }, []);

  /* --------------------------------------------------------------- view */
  const title = chapter.title?.trim() || `Chapter ${chapterIndex + 1}`;
  const barStyle: React.CSSProperties = {
    background: "color-mix(in srgb, var(--reader-bg) 86%, transparent)",
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
    borderColor: "color-mix(in srgb, var(--reader-fg) 10%, transparent)",
  };

  if (locked) {
    return (
      <div
        className="reader-root fixed inset-0 z-[45] flex flex-col items-center justify-center gap-4 px-8 text-center"
        data-theme={settings.theme}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-50">
          {story.title}
        </p>
        <h1 className="font-serif text-2xl">{title}</h1>
        <p className="max-w-xs text-sm opacity-70">
          This chapter is not published yet. Come back when the author opens it.
        </p>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
          Go back
        </Button>
      </div>
    );
  }

  return (
    <div
      className="reader-root fixed inset-0 z-[45] flex flex-col overflow-hidden"
      data-theme={settings.theme}
      style={{ background: "var(--reader-bg)", color: "var(--reader-fg)" }}
    >
      {/* hidden metric probe for the `ch` unit */}
      <span
        ref={measureRef}
        aria-hidden
        className="pointer-events-none absolute -left-[9999px] top-0 h-px"
        style={{
          display: "inline-block",
          width: "1ch",
          fontFamily: font.stack,
          fontSize: `${settings.fontSize}px`,
          visibility: "hidden",
        }}
      />

      {/* story progress */}
      <div
        className={cn(
          "absolute inset-x-0 top-0 z-40 h-[2px] origin-left transition-opacity duration-300",
          showChrome ? "opacity-100" : "opacity-0",
        )}
        style={{
          background: "var(--reader-accent)",
          transform: `scaleX(${storyProgress})`,
        }}
      />

      {/* --------------------------------------------------------- top bar */}
      <header
        className={cn(
          "z-30 shrink-0 border-b transition-all duration-300",
          settings.immersive ? "absolute inset-x-0 top-0" : "relative",
          showChrome
            ? "translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-2 opacity-0",
        )}
        style={barStyle}
      >
        <div
          className="flex items-center gap-2 px-2 py-2"
          style={{ paddingTop: "calc(0.5rem + env(safe-area-inset-top))" }}
        >
          <Button
            variant="ghost"
            size="icon"
            aria-label="Back"
            className="shrink-0 rounded-full"
            onClick={() => {
              if (window.history.length > 1) router.back();
              else router.push(`/story/${story.slug}`);
            }}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <div className="min-w-0 flex-1 text-center">
            <p
              className="truncate text-[13px] font-semibold leading-tight"
              style={{ fontFamily: "var(--font-read)" }}
            >
              {story.title}
            </p>
            <p className="truncate text-[11px] leading-tight opacity-55">{story.authorName}</p>
          </div>

          <Button
            variant="ghost"
            size="icon"
            aria-label="Comments"
            className="shrink-0 rounded-full"
            onClick={openComments}
          >
            <MessageSquare className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Reading settings"
            className="shrink-0 rounded-full"
            onClick={() => setSettingsOpen(true)}
          >
            <TypeIcon className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* --------------------------------------------------------- content */}
      <main
        ref={mainRef}
        className="relative min-h-0 flex-1"
        onPointerDown={openPointerDown}
        onPointerUp={openPointerUp}
        onPointerCancel={openPointerUp}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {settings.mode === "page" ? (
          <ReaderPages
            doc={chapter.content}
            typography={typography}
            contentWidth={contentWidth}
            onProgress={setProgressValue}
            onPageChange={handlePageChange}
            onSwipe={() => {
              swipedRef.current = true;
            }}
            dir={rtl ? "rtl" : "ltr"}
          />
        ) : (
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="h-full overflow-y-auto overscroll-contain"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            <div
              className="mx-auto w-full px-5 pb-24 pt-8"
              style={{ maxWidth: contentWidth + 40 }}
            >
              <header className="mb-8 text-center">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] opacity-45">
                  Chapter {chapterIndex + 1}
                </p>
                <h1
                  className="mt-2 font-serif text-2xl font-semibold leading-tight"
                  style={{ fontFamily: font.stack }}
                >
                  {title}
                </h1>
                {chapter.wordCount > 0 ? (
                  <p className="mt-2 text-[11px] opacity-45">
                    {chapter.wordCount.toLocaleString()} words
                  </p>
                ) : null}
              </header>

              <div dir={rtl ? "rtl" : "ltr"}>
                <ReaderContent doc={chapter.content} typography={typography} />
              </div>

              <footer className="mt-14 flex items-center justify-between gap-3 border-t pt-6" style={{ borderColor: "color-mix(in srgb, var(--reader-fg) 12%, transparent)" }}>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  disabled={!prevChapter}
                  onClick={() => prevChapter && goToChapter(prevChapter.id)}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Prev
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setChaptersOpen(true)}>
                  Chapters
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  disabled={!nextChapter}
                  onClick={() => nextChapter && goToChapter(nextChapter.id)}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </footer>
            </div>
          </div>
        )}

        {/* night dimmer */}
        {dim > 0 ? (
          <div
            className="pointer-events-none absolute inset-0 z-20 bg-black"
            style={{ opacity: dim }}
            aria-hidden
          />
        ) : null}
      </main>

      {/* ------------------------------------------------------- bottom bar */}
      <footer
        className={cn(
          "z-30 shrink-0 border-t transition-all duration-300",
          settings.immersive ? "absolute inset-x-0 bottom-0" : "relative",
          showChrome
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-2 opacity-0",
        )}
        style={barStyle}
      >
        <div className="h-[2px] w-full" style={{ background: "color-mix(in srgb, var(--reader-fg) 8%, transparent)" }}>
          <div
            className="h-full origin-left"
            style={{
              background: "var(--reader-accent)",
              transform: `scaleX(${progress})`,
              width: "100%",
            }}
          />
        </div>
        <div
          className="flex items-center gap-2 px-2 py-2"
          style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}
        >
          <Button
            variant="ghost"
            size="icon"
            aria-label="Previous chapter"
            className="shrink-0 rounded-full"
            disabled={!prevChapter}
            onClick={() => prevChapter && goToChapter(prevChapter.id)}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-auto min-w-0 flex-1 flex-col gap-0 rounded-full px-2 py-1.5"
            onClick={() => setChaptersOpen(true)}
          >
            <span className="flex w-full items-center justify-center gap-1.5 text-xs font-medium tabular-nums">
              <List className="h-3.5 w-3.5 shrink-0 opacity-60" />
              <span className="truncate">
                {settings.mode === "page"
                  ? `Page ${pageInfo.page + 1} of ${pageInfo.pages}`
                  : `Chapter ${chapterIndex + 1} of ${ordered.length || 1}`}
              </span>
            </span>
            <span className="w-full truncate text-[10px] tabular-nums opacity-50">
              {Math.round(progress * 100)}% of chapter · {Math.round(storyProgress * 100)}% of story
            </span>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            aria-label="Next chapter"
            className="shrink-0 rounded-full"
            disabled={!nextChapter}
            onClick={() => nextChapter && goToChapter(nextChapter.id)}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </footer>

      {/* ---------------------------------------------------------- sheets */}
      <ReaderSettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        onChange={update}
        dim={dim}
        onDimChange={setDim}
        fullscreen={fullscreen}
        onToggleFullscreen={toggleFullscreen}
      />
      <ReaderChaptersSheet
        open={chaptersOpen}
        onOpenChange={setChaptersOpen}
        chapters={ordered}
        parts={parts}
        currentChapterId={chapter.id}
        onSelect={goToChapter}
        theme={settings.theme}
      />

      {selection ? (
        <ReaderSelectionToolbar
          target={selection}
          onComment={requestComment}
          onClose={() => setSelection(null)}
        />
      ) : null}
    </div>
  );
}
