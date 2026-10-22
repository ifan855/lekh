import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur safe-top">
      <div className="flex h-14 items-center gap-3 px-4">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="font-serif text-xl font-semibold tracking-tight">lekh</span>
          <span className="hidden text-xs text-muted-foreground sm:inline">stories, unhurried</span>
        </Link>

        <form action="/search" className="ml-auto hidden max-w-sm flex-1 items-center md:flex">
          <div className="relative w-full">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input name="q" placeholder="Search stories, authors, tags" className="h-9 pl-9" />
          </div>
        </form>

        <nav className="ml-auto flex items-center gap-1 md:ml-2">
          <Button asChild variant="ghost" size="sm" className="md:hidden">
            <Link href="/search" aria-label="Search">
              <Search className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/library">Library</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/write">Write</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
