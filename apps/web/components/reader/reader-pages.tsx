"use client";

import * as React from "react";
import type { EditorDoc } from "@lekh/db";

import { cn } from "@/lib/utils";

import { ReaderContent, type ReaderTypography } from "./reader-content";

export type ReaderPagesProps = {
  doc: EditorDoc | null;
  typography: ReaderTypography;
  /** Desired text column width in px (the measure setting). */
  contentWidth: number;
  onProgress?: (progress: number) => void;
  onPageChange?: (page: number, pages: number) => void;
  /** Set when a horizontal swipe happened, so the parent can ignore the click. */
  onSwipe?: () => void;
  /** Text direction of the prose (right-to-left stories). */
  dir?: "ltr" | "rtl";
  className?: string;
};

const TOP_PAD = 20;
const BOTTOM_PAD = 26;
const SWIPE_THRESHOLD = 48;

/**
 * Paginated reading mode.
 *
 * The text lives in a CSS multi-column container whose `column-width` equals
 * the viewport width, so every column is exactly one page. We drive the
 * horizontal scroll ourselves (touch swipe + keyboard), which keeps the
 * "one page at a time" contract and gives us an exact page index.
 */
export function ReaderPages({
  doc,
  typography,
  contentWidth,
  onProgress,
  onPageChange,
  onSwipe,
  dir = "ltr",
  className,
}: ReaderPagesProps) {
  const outerRef = React.useRef<HTMLDivElement>(null);
  const scrollerRef = React.useRef<HTMLDivElement>(null);
  const [size, setSize] = React.useState({ width: 0, height: 0 });
  const [page, setPage] = React.useState(0);
  const [pages, setPages] = React.useState(1);

  const pageRef = React.useRef(0);
  const pagesRef = React.useRef(1);
  const widthRef = React.useRef(0);
  const animatingRef = React.useRef(false);
  const animTimerRef = React.useRef<number | null>(null);
  const touchRef = React.useRef<{ x: number; y: number } | null>(null);

  /* Keep the callbacks stable so the paging effects never thrash. */
  const pageChangeRef = React.useRef(onPageChange);
  const progressRef = React.useRef(onProgress);
  React.useEffect(() => {
    pageChangeRef.current = onPageChange;
    progressRef.current = onProgress;
  });

  const width = size.width;
  const height = size.height;
  const blockPadding = Math.max(16, Math.round((width - contentWidth) / 2));

  /* ---------------------------------------------------------------- size */
  React.useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setSize({ width: Math.round(rect.width), height: Math.round(rect.height) });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* ------------------------------------------------------------- paging */
  const goToPage = React.useCallback((next: number, smooth = true) => {
    const scroller = scrollerRef.current;
    const w = widthRef.current;
    if (!scroller || w <= 0) return;
    const max = Math.max(0, pagesRef.current - 1);
    const target = Math.min(max, Math.max(0, next));
    pageRef.current = target;
    setPage(target);
    if (animTimerRef.current) window.clearTimeout(animTimerRef.current);
    animatingRef.current = true;
    scroller.scrollTo({ left: target * w, behavior: smooth ? "smooth" : "auto" });
    animTimerRef.current = window.setTimeout(() => {
      animatingRef.current = false;
    }, 420);
  }, []);

  const nextPage = React.useCallback(() => goToPage(pageRef.current + 1), [goToPage]);
  const prevPage = React.useCallback(() => goToPage(pageRef.current - 1), [goToPage]);

  /* Recompute the number of pages whenever the content or the box changes. */
  React.useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || width <= 0) return;
    const total = Math.max(1, Math.round(scroller.scrollWidth / width));
    if (total !== pagesRef.current) {
      pagesRef.current = total;
      setPages(total);
      pageChangeRef.current?.(Math.min(pageRef.current, total - 1), total);
    }
    // Re-align the current page after a reflow.
    const clamped = Math.max(0, Math.min(pagesRef.current - 1, pageRef.current));
    pageRef.current = clamped;
    if (Math.abs(scroller.scrollLeft - clamped * width) > 1) {
      animatingRef.current = false;
      scroller.scrollTo({ left: clamped * width, behavior: "auto" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height, doc, typography.fontSize, typography.lineHeight, typography.paragraphSpacing, contentWidth]);

  React.useEffect(() => {
    widthRef.current = width;
  }, [width]);

  React.useEffect(() => {
    pageChangeRef.current?.(page, pages);
  }, [page, pages]);

  /* ----------------------------------------------------------- scrolling */
  const handleScroll = React.useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller || widthRef.current <= 0) return;
    const w = widthRef.current;
    const max = Math.max(1, scroller.scrollWidth);
    const progress = Math.min(1, Math.max(0, (scroller.scrollLeft + w) / max));
    progressRef.current?.(progress);
    if (animatingRef.current) return;
    const index = Math.min(pagesRef.current - 1, Math.max(0, Math.round(scroller.scrollLeft / w)));
    if (index !== pageRef.current) {
      pageRef.current = index;
      setPage(index);
    }
  }, []);

  /* -------------------------------------------------------------- touch */
  const handleTouchStart = React.useCallback((event: React.TouchEvent) => {
    const touch = event.touches[0];
    if (!touch) return;
    touchRef.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const handleTouchEnd = React.useCallback(
    (event: React.TouchEvent) => {
      const start = touchRef.current;
      touchRef.current = null;
      const touch = event.changedTouches[0];
      if (!start || !touch) return;
      const dx = start.x - touch.clientX;
      const dy = start.y - touch.clientY;
      if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy)) return;
      onSwipe?.();
      if (dx > 0) nextPage();
      else prevPage();
    },
    [nextPage, prevPage, onSwipe],
  );

  /* ------------------------------------------------------------ keyboard */
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.closest("input, textarea, select, [contenteditable='true']") ||
          target.closest("[role='dialog']"))
      ) {
        return;
      }
      switch (event.key) {
        case "ArrowRight":
        case "PageDown":
        case " ":
          event.preventDefault();
          nextPage();
          break;
        case "ArrowLeft":
        case "PageUp":
          event.preventDefault();
          prevPage();
          break;
        case "Home":
          event.preventDefault();
          goToPage(0);
          break;
        case "End":
          event.preventDefault();
          goToPage(pagesRef.current - 1);
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goToPage, nextPage, prevPage]);

  return (
    <div
      ref={outerRef}
      className={cn("relative h-full w-full overflow-hidden", className)}
      style={{ touchAction: "pan-y" }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div
        ref={scrollerRef}
        className="no-scrollbar absolute inset-x-0 overflow-x-auto overflow-y-hidden"
        style={{
          top: TOP_PAD,
          height: height > 0 ? Math.max(0, height - TOP_PAD - BOTTOM_PAD) : 0,
          columnWidth: width > 0 ? `${width}px` : "100%",
          columnGap: 0,
          columnFill: "auto",
          direction: "ltr",
          touchAction: "pan-y",
          overscrollBehavior: "contain",
          WebkitOverflowScrolling: "touch",
        }}
        onScroll={handleScroll}
      >
        <ReaderContent
          doc={doc}
          typography={typography}
          blockPadding={blockPadding}
          dir={dir}
        />
      </div>
    </div>
  );
}
