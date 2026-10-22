import Link from "next/link";
import { redirect } from "next/navigation";
import { KeyRound, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db, profiles } from "@lekh/db";
import { eq } from "drizzle-orm";

import { ProfileForm } from "@/components/settings/profile-form";
import { getViewer } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/auth/sign-in?next=/settings");

  const rows = await db.select().from(profiles).where(eq(profiles.id, viewer.userId)).limit(1);
  const profile = rows[0];

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 md:px-8">
      <h1 className="font-serif text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">Your profile, your keys, your account.</p>

      <div className="mt-6 space-y-5">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRound className="h-4 w-4" />
              Profile
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ProfileForm
              profile={{
                id: viewer.userId,
                displayName: profile?.displayName ?? viewer.displayName,
                username: profile?.username ?? viewer.username,
                bio: profile?.bio ?? "",
                avatarKey: profile?.avatarKey ?? null,
                language: profile?.language ?? "en",
                email: viewer.email,
              }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              MCP keys
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              MCP keys let an AI agent write and edit your stories for you. They can never comment,
              vote, or follow on your behalf.
            </p>
            <Button asChild variant="outline">
              <Link href="/settings/mcp">Manage MCP keys</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Session</CardTitle>
          </CardHeader>
          <CardContent>
            <Button asChild variant="ghost">
              <Link href="/auth/sign-out">Sign out</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
