"use client";

import * as React from "react";
import { Maximize2, Minimize2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { READER_FONTS, READER_MODES, READER_THEMES, readerFont, type ReaderMode } from "@/lib/fonts";
import type { ReaderSettings } from "@/lib/reader-settings";

import { MAX_DIM } from "./reader-prefs";

export type ReaderSettingsSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: ReaderSettings;
  onChange: (patch: Partial<ReaderSettings>) => void;
  dim: number;
  onDimChange: (value: number) => void;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
};

function useIsDesktop(): boolean {
  const [desktop, setDesktop] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return desktop;
}

function Section({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-55">{label}</h3>
        {hint ? <span className="text-[11px] tabular-nums opacity-45">{hint}</span> : null}
      </div>
      {children}
    </section>
  );
}

function Row({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-0.5">
      <div className="min-w-0">
        <p className="text-sm font-medium leading-tight">{label}</p>
        {description ? <p className="mt-0.5 text-xs opacity-55">{description}</p> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function ReaderSettingsSheet({
  open,
  onOpenChange,
  settings,
  onChange,
  dim,
  onDimChange,
  fullscreen,
  onToggleFullscreen,
}: ReaderSettingsSheetProps) {
  const desktop = useIsDesktop();
  const font = readerFont(settings.font);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={desktop ? "right" : "bottom"}
        data-theme={settings.theme}
        className={cn(
          "reader-root gap-0 p-0",
          settings.theme === "night" || settings.theme === "midnight" ? "dark" : "",
          desktop ? "w-full max-w-sm" : "max-h-[88dvh] rounded-t-3xl",
        )}
        style={{ background: "var(--reader-bg)", color: "var(--reader-fg)" }}
      >
        <SheetHeader className="px-5 pt-5">
          <SheetTitle className="font-serif text-lg">Reading preferences</SheetTitle>
          <SheetDescription className="text-xs opacity-60">
            Saved on this device. Adjust for comfort, not for the algorithm.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex-1 space-y-6 overflow-y-auto px-5 pb-8">
          {/* Theme ------------------------------------------------------- */}
          <Section label="Theme">
            <div className="grid grid-cols-4 gap-2">
              {READER_THEMES.map((theme) => {
                const active = settings.theme === theme.id;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => onChange({ theme: theme.id })}
                    className="flex flex-col items-center gap-1.5 rounded-xl py-1.5 transition-transform active:scale-95"
                    aria-pressed={active}
                  >
                    <span
                      className="h-9 w-9 rounded-full ring-1 ring-black/10 transition-shadow"
                      style={{
                        background: theme.swatch,
                        boxShadow: active ? "0 0 0 2px var(--reader-bg), 0 0 0 4px var(--reader-accent)" : undefined,
                      }}
                    />
                    <span className={cn("text-[11px]", active ? "font-semibold" : "opacity-60")}>
                      {theme.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </Section>

          <Separator style={{ background: "color-mix(in srgb, var(--reader-fg) 12%, transparent)" }} />

          {/* Font -------------------------------------------------------- */}
          <Section label="Typeface" hint={font.label}>
            <div className="grid gap-1.5">
              {READER_FONTS.map((option) => {
                const active = settings.font === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => onChange({ font: option.id })}
                    aria-pressed={active}
                    className={cn(
                      "flex items-center justify-between rounded-xl border px-3 py-2 text-left transition-colors",
                      active
                        ? "border-transparent"
                        : "border-transparent opacity-70 hover:opacity-100",
                    )}
                    style={{
                      background: active
                        ? "color-mix(in srgb, var(--reader-accent) 14%, transparent)"
                        : "color-mix(in srgb, var(--reader-fg) 5%, transparent)",
                      boxShadow: active ? "inset 0 0 0 1px var(--reader-accent)" : undefined,
                    }}
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{option.label}</span>
                      <span className="block truncate text-[11px] opacity-55">{option.description}</span>
                    </span>
                    <span className="ml-3 shrink-0 text-xl leading-none" style={{ fontFamily: option.stack }}>
                      Aa
                    </span>
                  </button>
                );
              })}
            </div>
          </Section>

          <Separator style={{ background: "color-mix(in srgb, var(--reader-fg) 12%, transparent)" }} />

          {/* Text size -------------------------------------------------- */}
          <Section label="Text size" hint={`${settings.fontSize}px`}>
            <div className="flex items-center gap-3">
              <span className="w-6 text-center text-xs opacity-60">A</span>
              <Slider
                min={16}
                max={26}
                step={1}
                value={[settings.fontSize]}
                onValueChange={([value]) => onChange({ fontSize: value })}
                aria-label="Text size"
              />
              <span className="w-7 text-center text-lg leading-none opacity-80">A</span>
            </div>
          </Section>

          {/* Line height ------------------------------------------------ */}
          <Section label="Line spacing" hint={settings.lineHeight.toFixed(2)}>
            <Slider
              min={1.2}
              max={2.2}
              step={0.05}
              value={[settings.lineHeight]}
              onValueChange={([value]) => onChange({ lineHeight: value })}
              aria-label="Line spacing"
            />
          </Section>

          {/* Measure ---------------------------------------------------- */}
          <Section label="Column width" hint={`${settings.measure} characters`}>
            <Slider
              min={26}
              max={64}
              step={1}
              value={[settings.measure]}
              onValueChange={([value]) => onChange({ measure: value })}
              aria-label="Column width"
            />
          </Section>

          {/* Paragraph spacing ------------------------------------------ */}
          <Section label="Paragraph spacing" hint={`${settings.paragraphSpacing.toFixed(1)} em`}>
            <Slider
              min={0}
              max={2}
              step={0.1}
              value={[settings.paragraphSpacing]}
              onValueChange={([value]) => onChange({ paragraphSpacing: value })}
              aria-label="Paragraph spacing"
            />
          </Section>

          <Separator style={{ background: "color-mix(in srgb, var(--reader-fg) 12%, transparent)" }} />

          {/* Alignment -------------------------------------------------- */}
          <Section label="Layout">
            <Row label="Justify text" description="Align both edges of every paragraph.">
              <Switch
                checked={settings.justify}
                onCheckedChange={(checked) => onChange({ justify: checked })}
                aria-label="Justify text"
              />
            </Row>
            <Row label="Immersive mode" description="Hide every control. Tap the middle to bring them back.">
              <Switch
                checked={settings.immersive}
                onCheckedChange={(checked) => onChange({ immersive: checked })}
                aria-label="Immersive mode"
              />
            </Row>
            <Row
              label="Screen dimmer"
              description="A soft veil for night reading."
            >
              <div className="flex items-center gap-2">
                <Slider
                  min={0}
                  max={MAX_DIM}
                  step={0.05}
                  value={[dim]}
                  onValueChange={([value]) => onDimChange(value)}
                  aria-label="Screen dimmer"
                  className="w-24"
                />
                <span className="w-9 text-right text-[11px] tabular-nums opacity-60">
                  {Math.round((dim / MAX_DIM) * 100)}%
                </span>
              </div>
            </Row>
            <Row label="Fullscreen" description="Hide browser and system chrome.">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={onToggleFullscreen}
                style={{ borderColor: "color-mix(in srgb, var(--reader-fg) 20%, transparent)" }}
              >
                {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                {fullscreen ? "Exit" : "Enter"}
              </Button>
            </Row>
          </Section>

          <Separator style={{ background: "color-mix(in srgb, var(--reader-fg) 12%, transparent)" }} />

          {/* Mode -------------------------------------------------------- */}
          <Section label="Reading mode">
            <Tabs
              value={settings.mode}
              onValueChange={(value) => onChange({ mode: value as ReaderMode })}
            >
              <TabsList className="grid w-full grid-cols-2">
                {READER_MODES.map((mode) => (
                  <TabsTrigger key={mode.id} value={mode.id} className="w-full">
                    {mode.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <p className="pt-1 text-xs opacity-55">
              {READER_MODES.find((mode) => mode.id === settings.mode)?.hint}
            </p>
          </Section>

          {/* Preview ----------------------------------------------------- */}
          <Section label="Preview">
            <div
              className="rounded-xl px-4 py-3"
              style={{ background: "color-mix(in srgb, var(--reader-fg) 5%, transparent)" }}
            >
              <p
                className="whitespace-pre-wrap"
                style={{
                  fontFamily: font.stack,
                  fontSize: `${settings.fontSize}px`,
                  lineHeight: settings.lineHeight,
                  textAlign: settings.justify ? "justify" : "left",
                }}
              >
                {"The lamps were still burning when she found the letter. "}
                {"She read it twice, then a third time, slower, as if the words might rearrange themselves."}
              </p>
            </div>
          </Section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
