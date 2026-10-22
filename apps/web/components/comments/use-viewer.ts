"use client";

import { useEffect, useState } from "react";

import { fetchCommentSession } from "./api";
import type { CommentViewer } from "./types";

let cached: Promise<CommentViewer | null> | null = null;

/** Cached (per browser session) lookup of the signed-in viewer. */
function loadViewer(): Promise<CommentViewer | null> {
  if (!cached) {
    cached = fetchCommentSession()
      .then((session) => session.user)
      .catch(() => null);
  }
  return cached;
}

export function useViewer(): { viewer: CommentViewer | null; loading: boolean } {
  const [viewer, setViewer] = useState<CommentViewer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    void loadViewer().then((result) => {
      if (!alive) return;
      setViewer(result);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  return { viewer, loading };
}
