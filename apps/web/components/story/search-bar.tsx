"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";

import { cn } from "@/lib/utils";

export type SearchSuggestion = {
  id: string;
  title: string;
  authorName: string;
  authorUsername: string;
  tags: string[];
};

type SearchBarProps = {
  initialQuery?: string;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
};

/**
 * Search field with live suggestions. Falls back to a plain GET to /search
 * when the live endpoint is unavailable.
 */
export function SearchBar({
  initialQuery = "",
  placeholder = "Search stories, authors, tags",
  className,
  autoFocus = false,
}: SearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
          headers: { accept: "application/json" },
        });
        if (!res.ok) throw new Error("search failed");
        const data = (await res.json()) as { results?: SearchSuggestion[] };
        setSuggestions(data.results ?? []);
        setOpen(true);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const q = query.trim();
    setOpen(false);
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
  };

  return (
    <div ref={boxRef} className={cn("relative", className)}>
      <form onSubmit={submit} role="search">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            name="q"
            value={query}
            autoFocus={autoFocus}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => suggestions.length > 0 && setOpen(true)}
            placeholder={placeholder}
            enterKeyHint="search"
            aria-label="Search stories, authors, tags"
            className="h-11 w-full rounded-xl border border-input bg-card pl-9 pr-10 text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {loading ? (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          ) : null}
        </div>
      </form>

      {open && suggestions.length > 0 ? (
        <ul className="absolute left-0 right-0 top-full z-30 mt-2 max-h-80 overflow-y-auto rounded-xl border border-border bg-popover p-1.5 shadow-lg">
          {suggestions.map((item) => (
            <li key={item.id}>
              <a
                href={`/story/${item.id}`}
                className="block rounded-lg px-3 py-2 transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <span className="block truncate text-sm font-medium">{item.title}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {item.authorName} @{item.authorUsername}
                  {item.tags.length ? ` · #${item.tags.slice(0, 3).join(" #")}` : ""}
                </span>
              </a>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                submit(new Event("submit") as unknown as React.FormEvent);
              }}
              className="mt-1 w-full rounded-lg px-3 py-2 text-left text-xs font-medium text-primary hover:bg-accent"
            >
              See all results for “{query.trim()}”
            </button>
          </li>
        </ul>
      ) : null}
    </div>
  );
}
