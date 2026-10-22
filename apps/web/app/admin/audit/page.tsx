import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FilterSelect } from "@/app/admin/_components/filter-select";
import { Forbidden } from "@/app/admin/_components/forbidden";
import { listAudit } from "@/app/admin/_lib/data";
import { getAdminViewer } from "@/app/admin/_lib/server";

export const metadata = { title: "Audit log · Admin" };

function fmtDate(date: Date): string {
  try {
    return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(
      new Date(date),
    );
  } catch {
    return new Date(date).toISOString();
  }
}

export default async function AdminAuditPage({
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
  const action = first(params.action);
  const actor = first(params.actor);

  const rows = await listAudit({ action, actor });
  const actions = Array.from(new Set(rows.map((row) => row.action))).sort();
  const current = { ...(action ? { action } : {}), ...(actor ? { actor } : {}) };

  return (
    <div className="space-y-4">
      <form method="get" className="flex flex-wrap items-center gap-2">
        <Input
          name="actor"
          defaultValue={actor}
          placeholder="Filter by actor (username, name or id)"
          className="h-10 min-w-0 flex-1"
          aria-label="Filter by actor"
        />
        {action ? <input type="hidden" name="action" value={action} /> : null}
        <Button type="submit" size="sm" variant="outline">
          Filter
        </Button>
        {action || actor ? (
          <Button asChild size="sm" variant="ghost">
            <Link href="/admin/audit">Clear</Link>
          </Button>
        ) : null}
      </form>

      <div className="flex items-center gap-2">
        <FilterSelect
          name="action"
          value={action}
          label="Action"
          current={current}
          className="h-9 w-[11rem] text-xs"
          options={[
            { value: "all", label: "All actions" },
            ...actions.map((value) => ({ value, label: value })),
          ]}
        />
        <span className="text-xs text-muted-foreground">{rows.length} shown</span>
      </div>

      <div className="space-y-2">
        {rows.length === 0 ? (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">
              No audit entries matched this filter.
            </CardContent>
          </Card>
        ) : (
          rows.map((row) => (
            <Card key={row.id}>
              <CardContent className="space-y-1 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{row.action}</Badge>
                  <span className="text-xs text-muted-foreground">{fmtDate(row.createdAt)}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {row.actorUsername ? (
                    <>
                      by <span className="text-foreground">@{row.actorUsername}</span>
                      {row.actorName ? ` (${row.actorName})` : ""}
                    </>
                  ) : (
                    "by an unknown actor"
                  )}
                  {row.targetType ? (
                    <>
                      {" · "}
                      {row.targetType}
                      {row.targetId ? (
                        <span className="font-mono text-[11px]"> {row.targetId}</span>
                      ) : null}
                    </>
                  ) : null}
                </p>
                {row.meta && Object.keys(row.meta as Record<string, unknown>).length ? (
                  <pre className="overflow-x-auto rounded-md bg-muted/60 p-2 text-[11px] leading-snug">
                    {JSON.stringify(row.meta, null, 1)}
                  </pre>
                ) : null}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
