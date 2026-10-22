/**
 * Typography system.
 *
 * `read` fonts are used by the reader (and the writer preview), `ui` fonts by
 * the interface. All fonts are self-hosted through next/font — no external
 * requests at runtime.
 */
export type FontId =
  | "literary"
  | "nocturne"
  | "atlas"
  | "hyperlegible"
  | "typewriter"
  | "grotesk";

export type ReaderFont = {
  id: FontId;
  label: string;
  cssVar: string;
  stack: string;
  description: string;
};

export const READER_FONTS: ReaderFont[] = [
  {
    id: "literary",
    label: "Literary",
    cssVar: "var(--font-read)",
    stack: "var(--font-read), Georgia, serif",
    description: "A warm serif built for long reading.",
  },
  {
    id: "nocturne",
    label: "Nocturne",
    cssVar: "var(--font-read)",
    stack: "var(--font-read), Georgia, serif",
    description: "Classic book serif with high contrast.",
  },
  {
    id: "atlas",
    label: "Atlas",
    cssVar: "var(--font-ui)",
    stack: "var(--font-ui), system-ui, sans-serif",
    description: "Clean sans-serif for a modern feel.",
  },
  {
    id: "hyperlegible",
    label: "Hyperlegible",
    cssVar: "var(--font-dyslexia)",
    stack: "var(--font-dyslexia), system-ui, sans-serif",
    description: "Atkinson Hyperlegible — wider letterforms, easier to read.",
  },
  {
    id: "typewriter",
    label: "Typewriter",
    cssVar: "var(--font-mono)",
    stack: "var(--font-mono), ui-monospace, monospace",
    description: "Monospaced, for drafts and notes.",
  },
  {
    id: "grotesk",
    label: "Grotesk",
    cssVar: "var(--font-ui)",
    stack: "var(--font-ui), system-ui, sans-serif",
    description: "Neutral grotesque, crisp on mobile.",
  },
];

export function readerFont(id: string | undefined | null): ReaderFont {
  return READER_FONTS.find((f) => f.id === id) ?? READER_FONTS[0];
}

export type ReaderTheme = "light" | "sepia" | "night" | "midnight";

export const READER_THEMES: { id: ReaderTheme; label: string; swatch: string }[] = [
  { id: "light", label: "Paper", swatch: "#ffffff" },
  { id: "sepia", label: "Sepia", swatch: "#f4ecd8" },
  { id: "night", label: "Night", swatch: "#17181c" },
  { id: "midnight", label: "Midnight", swatch: "#000000" },
];

export type ReaderMode = "scroll" | "page";

export const READER_MODES: { id: ReaderMode; label: string; hint: string }[] = [
  { id: "scroll", label: "Scroll", hint: "Continuous reading, like a web page." },
  { id: "page", label: "Page turn", hint: "One screen at a time, swipe to turn." },
];

export type WriterFontId = "literary" | "atlas" | "typewriter" | "grotesk";

export const WRITER_FONTS: { id: WriterFontId; label: string; stack: string }[] = [
  { id: "literary", label: "Literary", stack: "var(--font-read), Georgia, serif" },
  { id: "atlas", label: "Atlas", stack: "var(--font-ui), system-ui, sans-serif" },
  { id: "typewriter", label: "Typewriter", stack: "var(--font-mono), ui-monospace, monospace" },
  { id: "grotesk", label: "Grotesk", stack: "var(--font-ui), system-ui, sans-serif" },
];

export function writerFontStack(id: string | undefined | null): string {
  return WRITER_FONTS.find((f) => f.id === id)?.stack ?? WRITER_FONTS[0].stack;
}
