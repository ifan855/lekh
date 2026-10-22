"use client";

import * as React from "react";
import type { BlockNode, EditorDoc, InlineNode } from "@lekh/db";

import { cn } from "@/lib/utils";

export type ReaderTypography = {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  justify: boolean;
  paragraphSpacing: number;
};

export type ReaderContentProps = {
  doc: EditorDoc | null;
  typography: ReaderTypography;
  className?: string;
  style?: React.CSSProperties;
  /** Horizontal inset applied to every block (used by the paginated mode). */
  blockPadding?: number;
  /** Text direction of the prose (right-to-left stories). */
  dir?: "ltr" | "rtl";
};

function markHref(mark: { attrs?: Record<string, unknown> }): string {
  const href = mark.attrs?.href;
  return typeof href === "string" && href.length > 0 ? href : "#";
}

function renderInline(nodes: InlineNode[] | undefined): React.ReactNode {
  const list = nodes ?? [];
  return list.map((node, index) => {
    if (!node || node.type !== "text" || typeof node.text !== "string") return null;
    let out: React.ReactNode = node.text;
    const marks = node.marks ?? [];
    for (const mark of marks) {
      switch (mark.type) {
        case "bold":
          out = <strong className="font-semibold">{out}</strong>;
          break;
        case "italic":
          out = <em className="italic">{out}</em>;
          break;
        case "underline":
          out = <span className="underline decoration-1 underline-offset-[3px]">{out}</span>;
          break;
        case "strike":
          out = <s className="line-through opacity-80">{out}</s>;
          break;
        case "code":
          out = (
            <code className="rounded-[4px] bg-black/10 px-1 py-0.5 font-mono text-[0.86em] leading-none">
              {out}
            </code>
          );
          break;
        case "highlight":
          out = (
            <mark className="rounded-[3px] px-0.5 text-inherit" style={{ background: "var(--reader-accent)" }}>
              {out}
            </mark>
          );
          break;
        case "link": {
          const href = markHref(mark);
          const external = /^https?:\/\//i.test(href);
          out = (
            <a
              href={href}
              className="underline decoration-1 underline-offset-[3px] transition-colors"
              style={{ color: "var(--reader-accent)" }}
              {...(external ? { target: "_blank", rel: "noreferrer noopener" } : {})}
            >
              {out}
            </a>
          );
          break;
        }
        default:
          break;
      }
    }
    return <React.Fragment key={index}>{out}</React.Fragment>;
  });
}

type BlockProps = {
  block: BlockNode;
  index: number;
  typography: ReaderTypography;
  blockPadding: number;
};

function ReaderBlock({ block, index, typography, blockPadding }: BlockProps) {
  const rawId = block.attrs?.id;
  const id = typeof rawId === "string" && rawId.length > 0 ? rawId : `block-${index}`;
  const gap = `${typography.paragraphSpacing}em`;
  const inline = { paddingInline: blockPadding } as const;

  switch (block.type) {
    case "heading": {
      const level = block.attrs?.level === 1 || block.attrs?.level === 3 ? block.attrs.level : 2;
      const Tag = (level === 1 ? "h1" : level === 2 ? "h2" : "h3") as "h1" | "h2" | "h3";
      const scale = level === 1 ? 1.55 : level === 2 ? 1.3 : 1.1;
      return (
        <Tag
          data-block-id={id}
          style={{
            ...inline,
            fontSize: `${scale}em`,
            lineHeight: 1.22,
            fontWeight: 600,
            letterSpacing: "-0.012em",
            paddingTop: level === 1 ? "0.1em" : "1.1em",
            paddingBottom: "0.35em",
            textAlign: "left",
          }}
        >
          {renderInline(block.content)}
        </Tag>
      );
    }
    case "blockquote":
      return (
        <blockquote
          data-block-id={id}
          style={{
            ...inline,
            paddingBottom: gap,
            paddingLeft: `calc(${blockPadding}px + 1em)`,
            borderLeft: "2px solid var(--reader-accent)",
            fontStyle: "italic",
            opacity: 0.92,
            textAlign: "left",
          }}
        >
          {renderInline(block.content)}
        </blockquote>
      );
    case "hr":
      return (
        <hr
          data-block-id={id}
          style={{
            ...inline,
            margin: "1.4em 0",
            border: 0,
            borderTop: "1px solid color-mix(in srgb, var(--reader-fg) 18%, transparent)",
          }}
        />
      );
    case "image": {
      const src = typeof block.attrs?.src === "string" ? block.attrs.src : "";
      const alt = typeof block.attrs?.alt === "string" ? block.attrs.alt : "";
      if (!src) return null;
      return (
        <figure data-block-id={id} style={{ ...inline, paddingBottom: gap }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} className="w-full rounded-xl" loading="lazy" />
        </figure>
      );
    }
    default:
      return (
        <p
          data-block-id={id}
          className="whitespace-pre-wrap"
          style={{
            ...inline,
            paddingBottom: gap,
            textAlign: typography.justify ? "justify" : "left",
            hyphens: typography.justify ? "auto" : "manual",
          }}
        >
          {renderInline(block.content)}
        </p>
      );
  }
}

export function ReaderContent({
  doc,
  typography,
  className,
  style,
  blockPadding = 0,
  dir = "ltr",
}: ReaderContentProps) {
  const blocks = doc?.content ?? [];
  return (
    <div
      className={cn("relative", className)}
      dir={dir}
      style={{
        ...style,
        fontFamily: typography.fontFamily,
        fontSize: `${typography.fontSize}px`,
        lineHeight: typography.lineHeight,
        color: "inherit",
      }}
    >
      {blocks.map((block, index) => (
        <ReaderBlock
          key={typeof block.attrs?.id === "string" ? block.attrs.id : `block-${index}`}
          block={block}
          index={index}
          typography={typography}
          blockPadding={blockPadding}
        />
      ))}
    </div>
  );
}
