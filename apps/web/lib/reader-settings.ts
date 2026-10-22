"use client";

import type { FontId, ReaderMode, ReaderTheme } from "./fonts";

export type ReaderSettings = {
  theme: ReaderTheme;
  font: FontId;
  fontSize: number; // px
  lineHeight: number; // multiplier
  measure: number; // max content width in ch
  mode: ReaderMode;
  immersive: boolean;
  justify: boolean;
  paragraphSpacing: number; // em
};

export const DEFAULT_READER_SETTINGS: ReaderSettings = {
  theme: "sepia",
  font: "literary",
  fontSize: 19,
  lineHeight: 1.7,
  measure: 38,
  mode: "scroll",
  immersive: false,
  justify: false,
  paragraphSpacing: 0.9,
};

const STORAGE_KEY = "lekh.reader.settings.v1";

export function loadReaderSettings(): ReaderSettings {
  if (typeof window === "undefined") return DEFAULT_READER_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_READER_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<ReaderSettings>;
    return { ...DEFAULT_READER_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_READER_SETTINGS;
  }
}

export function saveReaderSettings(settings: ReaderSettings): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}
