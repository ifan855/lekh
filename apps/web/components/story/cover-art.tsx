import { coverGradient } from "@/lib/cover";
import { languageLabel } from "@/lib/languages";
import { cn } from "@/lib/utils";

import { coverUrl } from "./files";

type CoverArtProps = {
  title: string;
  coverKey?: string | null;
  coverColor?: string | null;
  language?: string | null;
  fontPreset?: string | null;
  seed?: string;
  className?: string;
  /** Render the title over the artwork. */
  showTitle?: boolean;
  /** Small rounded badge with the language. */
  showBadge?: boolean;
  sizes?: string;
};

const FONT_STACKS: Record<string, string> = {
  literary: "var(--font-read), Georgia, serif",
  nocturne: "var(--font-read), Georgia, serif",
  atlas: "var(--font-ui), system-ui, sans-serif",
  hyperlegible: "var(--font-dyslexia), system-ui, sans-serif",
  typewriter: "var(--font-mono), ui-monospace, monospace",
  grotesk: "var(--font-ui), system-ui, sans-serif",
};

export function fontStackFor(fontPreset?: string | null): string {
  return FONT_STACKS[fontPreset ?? ""] ?? FONT_STACKS.literary;
}

/**
 * Cover artwork.
 *
 * When the author uploaded a cover we show it. Otherwise we build a
 * typographic cover from the title over a deterministic gradient, so every
 * story still looks designed.
 */
export function CoverArt({
  title,
  coverKey,
  coverColor,
  language,
  fontPreset,
  seed,
  className,
  showTitle = true,
  showBadge = true,
  sizes,
}: CoverArtProps) {
  const src = coverUrl(coverKey);
  const gradient = coverColor
    ? `linear-gradient(145deg, ${coverColor}, ${shade(coverColor)})`
    : coverGradient(seed ?? title);

  return (
    <div
      className={cn(
        "relative isolate overflow-hidden rounded-xl bg-muted",
        "aspect-[3/4] w-full shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)]",
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={`Cover of ${title}`}
          loading="lazy"
          decoding="async"
          sizes={sizes}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <>
          <div className="absolute inset-0" style={{ backgroundImage: gradient }} aria-hidden />
          <div
            className="absolute inset-0 opacity-70"
            aria-hidden
            style={{
              backgroundImage:
                "radial-gradient(120% 90% at 18% 12%, rgba(255,255,255,0.35), transparent 55%), radial-gradient(90% 70% at 90% 100%, rgba(0,0,0,0.35), transparent 60%)",
            }}
          />
          {showTitle ? (
            <div className="absolute inset-0 flex flex-col justify-end p-3 sm:p-4">
              <p
                className="line-clamp-4 text-[0.95rem] font-semibold leading-tight text-white drop-shadow-[0_1px_6px_rgba(0,0,0,0.5)] sm:text-lg"
                style={{ fontFamily: fontStackFor(fontPreset) }}
              >
                {title}
              </p>
              <span className="mt-2 h-px w-10 bg-white/60" aria-hidden />
            </div>
          ) : null}
        </>
      )}

      {showBadge && language ? (
        <span className="absolute left-2 top-2 rounded-full bg-black/45 px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-white backdrop-blur-sm">
          {languageLabel(language)}
        </span>
      ) : null}
    </div>
  );
}

/** Darken a hex colour slightly for the gradient's second stop. */
function shade(hex: string): string {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return hex;
  const value = parseInt(match[1], 16);
  const r = Math.max(0, Math.round(((value >> 16) & 0xff) * 0.72));
  const g = Math.max(0, Math.round(((value >> 8) & 0xff) * 0.72));
  const b = Math.max(0, Math.round((value & 0xff) * 0.72));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
