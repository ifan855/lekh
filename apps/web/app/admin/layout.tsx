import Link from "next/link";

import { Button } from "@/components/ui/button";
import { getAdminViewer } from "@/app/admin/_lib/server";
import { Forbidden } from "@/app/admin/_components/forbidden";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/stories", label: "Stories" },
  { href: "/admin/comments", label: "Comments" },
  { href: "/admin/tags", label: "Tags" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/admin/audit", label: "Audit" },
];

export const metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getAdminViewer();

  if (!viewer) {
    return (
      <div className="px-4 py-6">
        <Forbidden />
      </div>
    );
  }

  return (
    <div className="px-3 py-4 sm:px-5">
      <div className="mb-4 flex items-center gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Admin</h1>
          <p className="text-xs text-muted-foreground">
            Signed in as {viewer.displayName} · {viewer.username}
          </p>
        </div>
        <Button asChild size="sm" variant="outline" className="ml-auto">
          <Link href="/admin">Admin home</Link>
        </Button>
      </div>

      <nav
        aria-label="Admin sections"
        className="-mx-3 mb-4 flex gap-1 overflow-x-auto px-3 pb-1 sm:mx-0 sm:px-0"
      >
        {NAV.map((item) => (
          <Button key={item.href} asChild size="sm" variant="outline" className="shrink-0">
            <Link href={item.href}>{item.label}</Link>
          </Button>
        ))}
      </nav>

      <div className="pb-16">{children}</div>
    </div>
  );
}
