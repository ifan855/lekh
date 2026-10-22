"use client";

import * as React from "react";

/**
 * Reader preferences that are not part of `ReaderSettings` (kept separate so
 * we never have to touch lib/reader-settings.ts). Currently: the screen
 * dimmer used for night reading.
 */
const DIMMER_KEY = "lekh.reader.dimmer.v1";

export const MAX_DIM = 0.6;

export function loadDimmer(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(DIMMER_KEY);
    if (!raw) return 0;
    const value = Number.parseFloat(raw);
    if (!Number.isFinite(value)) return 0;
    return Math.min(MAX_DIM, Math.max(0, value));
  } catch {
    return 0;
  }
}

export function saveDimmer(value: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DIMMER_KEY, String(value));
  } catch {
    /* ignore */
  }
}

export function useDimmer(): { dim: number; setDim: (value: number) => void } {
  const [dim, setDimState] = React.useState(0);

  React.useEffect(() => {
    setDimState(loadDimmer());
  }, []);

  const setDim = React.useCallback((value: number) => {
    const clamped = Math.min(MAX_DIM, Math.max(0, value));
    setDimState(clamped);
    saveDimmer(clamped);
  }, []);

  return { dim, setDim };
}
