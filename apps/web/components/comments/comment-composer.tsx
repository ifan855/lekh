"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import { CommentsApiError } from "./api";
import { useViewer } from "./use-viewer";

export const MAX_COMMENT_LENGTH = 2000;

export type CommentComposerProps = {
  storyId: string;
  chapterId?: string | null;
  blockId?: string | null;
  quotedText?: string | null;
  parentId?: string | null;
  /** Pre-fills the textarea (used when commenting on a selected passage). */
  initialValue?: string;
  placeholder?: string;
  submitLabel?: string;
  autoFocus?: boolean;
  compact?: boolean;
  className?: string;
  onSubmitted?: (body: string) => void | Promise<void>;
  onCancel?: () => void;
  /** Called when the comment could not be sent (already toasted by default). */
  onError?: (message: string) => void;
};

export function CommentComposer({
  storyId,
  chapterId = null,
  blockId = null,
  quotedText = null,
  parentId = null,
  initialValue = "",
  placeholder = "Add to the discussion…",
  submitLabel = "Post",
  autoFocus = false,
  compact = false,
  className,
  onSubmitted,
  onCancel,
  onError,
}: CommentComposerProps) {
  const { viewer, loading } = useViewer();
  const [value, setValue] = useState(initialValue);
  const [pending, setPending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  useEffect(() => {
    if (autoFocus) textareaRef.current?.focus();
  }, [autoFocus]);

  const trimmed = value.trim();
  const tooLong = trimmed.length > MAX_COMMENT_LENGTH;
  const canSubmit = trimmed.length > 0 && trimmed.length <= MAX_COMMENT_LENGTH && !pending;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    setPending(true);
    try {
      await onSubmitted?.(trimmed);
      setValue("");
      textareaRef.current?.focus();
    } catch (error) {
      const message =
        error instanceof CommentsApiError ? error.message : "Could not post your comment";
      toast.error(message);
      onError?.(message);
    } finally {
      setPending(false);
    }
  }

  if (loading) {
    return <div className={className} aria-hidden />;
  }

  if (!viewer) {
    return (
      <div className={className}>
        <div className="rounded-xl border border-dashed bg-muted/40 p-4 text-sm text-muted-foreground">
          <p>Sign in to join the discussion.</p>
          <Button asChild size="sm" className="mt-3 h-10">
            <Link href="/auth/sign-in">Sign in to comment</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={className} data-story-id={storyId}>
      {quotedText ? (
        <blockquote className="mb-2 border-l-2 border-primary/40 bg-muted/50 px-3 py-2 text-sm italic text-muted-foreground">
          “{quotedText.length > 220 ? `${quotedText.slice(0, 220)}…` : quotedText}”
        </blockquote>
      ) : null}

      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        rows={compact ? 2 : 3}
        maxLength={MAX_COMMENT_LENGTH + 200}
        aria-label={placeholder}
        className={compact ? "min-h-[64px]" : undefined}
      />

      <div className="mt-2 flex items-center gap-2">
        <span
          className={`text-xs tabular-nums ${
            tooLong ? "font-medium text-destructive" : "text-muted-foreground"
          }`}
        >
          {trimmed.length}/{MAX_COMMENT_LENGTH}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {onCancel ? (
            <Button type="button" variant="ghost" size="sm" className="h-10" onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
          <Button type="submit" size="sm" className="h-10" disabled={!canSubmit}>
            {pending ? "Posting…" : submitLabel}
          </Button>
        </div>
      </div>

      {parentId ? <span className="sr-only">Replying to a comment</span> : null}
    </form>
  );
}

export default CommentComposer;
