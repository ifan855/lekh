"use client";

import { Check, CloudOff, Loader2, Pencil } from "lucide-react";

import { cn } from "@/lib/utils";

export type SaveState = "idle" | "dirty" | "saving" | "saved" | "error" | "local";

export function SaveStatus({ state, savedAt }: { state: SaveState; savedAt?: Date | null }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors",
        state === "error" && "text-destructive",
      )}
      aria-live="polite"
    >
      {state === "saving" && (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Saving…
        </>
      )}
      {state === "dirty" && (
        <>
          <Pencil className="h-3.5 w-3.5" />
          Unsaved
        </>
      )}
      {state === "saved" && (
        <>
          <Check className="h-3.5 w-3.5 text-primary" />
          Saved{savedAt ? ` ${savedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}
        </>
      )}
      {state === "idle" && <span>Ready</span>}
      {state === "local" && (
        <>
          <CloudOff className="h-3.5 w-3.5" />
          Saved on this device
        </>
      )}
      {state === "error" && (
        <>
          <CloudOff className="h-3.5 w-3.5" />
          Couldn&apos;t save
        </>
      )}
    </span>
  );
}
