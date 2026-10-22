import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { UserActions } from "@/app/admin/_components/user-actions";
import { FilterSelect } from "@/app/admin/_components/filter-select";
import { Forbidden } from "@/app/admin/_components/forbidden";
import { listUsers } from "@/app/admin/_lib/data";
import { getAdminViewer } from "@/app/admin/_lib/server";

export const metadata = { title: "Users · Admin" };

function fmtDate(date: Date): string {
  try {
    return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(date));
  } catch {
    return new Date(date).toISOString().slice(0, 10);
  }
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const viewer = await getAdminViewer();
  if (!viewer) return <Forbidden />;

  const params = await searchParams;
  const first = (value: string | string[] | undefined): string => {
    if (Array.isArray(value)) return value[0] ?? "";
    return value ?? "";
  };
  const q = first(params.q);
  const role = first(params.role);

  const users = await listUsers({ q, role });
  const current = { ...(q ? { q } : {}), ...(role ? { role } : {}) };

  return (
    <div className="space-y-4">
      <form method="get" className="flex flex-wrap items-center gap-2">
        <Input
          name="q"
          defaultValue={q}
          placeholder="Search username, display name or e-mail"
          className="h-10 min-w-0 flex-1"
          aria-label="Search users"
        />
        {role ? <input type="hidden" name="role" value={role} /> : null}
        <Button type="submit" size="sm" variant="outline">
          Search
        </Button>
        {q || role ? (
          <Button asChild size="sm" variant="ghost">
            <Link href="/admin/users">Clear</Link>
          </Button>
        ) : null}
      </form>

      <div className="flex items-center gap-2">
        <FilterSelect
          name="role"
          value={role}
          label="Role"
          current={current}
          className="h-9 w-[10rem] text-xs"
          options={[
            { value: "all", label: "All roles" },
            { value: "user", label: "Members" },
            { value: "admin", label: "Admins" },
            { value: "banned", label: "Banned" },
          ]}
        />
        <span className="text-xs text-muted-foreground">{users.length} shown</span>
      </div>

      <div className="space-y-2">
        {users.length === 0 ? (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">
              No members matched this filter.
            </CardContent>
          </Card>
        ) : (
          users.map((user) => (
            <Card key={user.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{user.displayName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      @{user.username}
                      {user.email ? ` · ${user.email}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant={user.role === "admin" ? "default" : user.role === "banned" ? "destructive" : "muted"}>
                      {user.role}
                    </Badge>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>{user.storyCount} stories</span>
                  <span>·</span>
                  <span>{user.commentCount} comments</span>
                  <span>·</span>
                  <span>joined {fmtDate(user.createdAt)}</span>
                </div>

                <UserActions
                  userId={user.id}
                  username={user.username}
                  role={user.role}
                  storyCount={user.storyCount}
                  isSelf={user.id === viewer.userId}
                />
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Bans set the member role to <code>banned</code> — the sign-in flow must refuse that role.
        Admins can lift the ban at any time.
      </p>
    </div>
  );
}
