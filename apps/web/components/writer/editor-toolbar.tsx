"use client";

import { useState } from "react";
import type { Editor } from "@tiptap/react";
import {
  Bold,
  BookOpen,
  Heading1,
  Heading2,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  ScanText,
  Sparkles,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { WRITER_FONTS } from "@/lib/fonts";
import { cn } from "@/lib/utils";

type Props = {
  editor: Editor | null;
  fontPreset: string;
  onFontPresetChange: (preset: string) => void;
  onRequestOcr?: () => void;
  onSave: () => void;
};

function ToolButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        "tap flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
        active && "bg-accent text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export function EditorToolbar({ editor, fontPreset, onFontPresetChange, onRequestOcr, onSave }: Props) {
  const [more, setMore] = useState(false);

  const setLink = () => {
    if (!editor) return;
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", previous ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().setLink({ href: url }).run();
  };

  const addImage = () => {
    if (!editor) return;
    const url = window.prompt("Image URL");
    if (!url) return;
    editor.chain().focus().setImage({ src: url, alt: "" }).run();
  };

  return (
    <div className="sticky bottom-0 z-30 border-t bg-background/95 backdrop-blur safe-bottom">
      <div className="no-scrollbar flex items-center gap-1 overflow-x-auto px-2 py-1.5">
        <ToolButton
          label="Bold"
          active={editor?.isActive("bold")}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          label="Italic"
          active={editor?.isActive("italic")}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          label="Underline"
          active={editor?.isActive("underline")}
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          label="Strikethrough"
          active={editor?.isActive("strike")}
          onClick={() => editor?.chain().focus().toggleStrike().run()}
        >
          <Strikethrough className="h-4 w-4" />
        </ToolButton>

        <span className="mx-1 h-6 w-px shrink-0 bg-border" />

        <ToolButton
          label="Heading 1"
          active={editor?.isActive("heading", { level: 1 })}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
        >
          <Heading1 className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          label="Heading 2"
          active={editor?.isActive("heading", { level: 2 })}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          label="Quote"
          active={editor?.isActive("blockquote")}
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
        >
          <Quote className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          label="Bullet list"
          active={editor?.isActive("bulletList")}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          <List className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          label="Numbered list"
          active={editor?.isActive("orderedList")}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-4 w-4" />
        </ToolButton>

        <span className="mx-1 h-6 w-px shrink-0 bg-border" />

        <ToolButton label="Link" active={editor?.isActive("link")} onClick={setLink}>
          <Link2 className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Undo" onClick={() => editor?.chain().focus().undo().run()}>
          <Undo2 className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Redo" onClick={() => editor?.chain().focus().redo().run()}>
          <Redo2 className="h-4 w-4" />
        </ToolButton>

        <Sheet open={more} onOpenChange={setMore}>
          <SheetTrigger asChild>
            <button
              type="button"
              aria-label="More formatting options"
              className="tap flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <Sparkles className="h-4 w-4" />
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto">
            <SheetTitle>Formatting</SheetTitle>

            <div className="space-y-4">
              <div>
                <p className="mb-2 text-sm font-medium">Book font</p>
                <div className="grid grid-cols-2 gap-2">
                  {WRITER_FONTS.map((font) => (
                    <button
                      key={font.id}
                      type="button"
                      onClick={() => {
                        onFontPresetChange(font.id);
                        setMore(false);
                      }}
                      className={cn(
                        "rounded-lg border px-3 py-3 text-left text-sm",
                        fontPreset === font.id && "border-primary bg-primary/5",
                      )}
                      style={{ fontFamily: font.stack }}
                    >
                      {font.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={addImage}>
                  <ImagePlus className="h-4 w-4" />
                  Image from URL
                </Button>
                {onRequestOcr && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setMore(false);
                      onRequestOcr();
                    }}
                  >
                    <ScanText className="h-4 w-4" />
                    Text from photos
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => { setMore(false); onSave(); }}>
                  <BookOpen className="h-4 w-4" />
                  Save now
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
