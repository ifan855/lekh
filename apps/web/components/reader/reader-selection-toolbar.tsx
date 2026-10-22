"use client";

import * as React from "react";
import { MessageSquarePlus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { SelectionTarget } from "./types";

export type ReaderSelectionToolbarProps = {
  target: SelectionTarget;
  onComment: (blockId: string, quote: string) => void;
  onClose: () => void;
};

/**
 * Floating toolbar that appears when the reader picks a piece of text.
 * It is the reader's only "comment" affordance: pressing it hands the
 * selected block + quote back to the comments layer.
 */
export function ReaderSelectionToolbar({ target, onComment, onClose }: ReaderSelectionToolbarProps) {
  const [viewport, setViewport] = React.useState({ width: 0, height: 0 });

  React.useEffect(() => {
    const update = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const left = viewport.width > 0 ? Math.min(Math.max(target.x, 96), viewport.width - 96) : target.x;
  const top = viewport.height > 0 ? Math.min(Math.max(target.y, 64), viewport.height - 24) : target.y;

  return (
    <div
      role="toolbar"
      aria-label="Text actions"
      className={cn(
        "fixed z-[60] flex -translate-x-1/2 -translate-y-full items-center gap-1 rounded-full p-1 shadow-lg",
        "animate-in fade-in-0 zoom-in-95 duration-150",
      )}
      style={{
        left,
        top,
        background: "var(--reader-bg)",
        color: "var(--reader-fg)",
        border: "1px solid color-mix(in srgb, var(--reader-fg) 14%, transparent)",
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <Button
        size="sm"
        className="h-9 gap-1.5 rounded-full border-0 px-3"
        style={{ background: "var(--reader-accent)", color: "#fff" }}
        onClick={() => onComment(target.blockId, target.quote)}
      >
        <MessageSquarePlus className="h-4 w-4" />
        Comment
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        className="rounded-full"
        aria-label="Close"
        onClick={onClose}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
