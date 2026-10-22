import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FilterSelect } from "@/app/admin/_components/filter-select";
import { Forbidden } from "@/app/admin/_components/forbidden";
import { ReportActions } from "@/app/admin/_components/report-actions";
import { listReports } from "@/app/admin/_lib/data";
import { getAdminViewer } from "@/app/admin/_lib/server";

export const metadata = { title: "Comments · Admin" };

function fmtDate(date: Date): string {
  try {
    return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(
      new Date(date),
    );
  } catch {
    return new Date(date).toISOString();
  }
}

export default async function AdminCommentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const viewer = await getAdminViewer();
  if (!viewer) return <Forbidden />;

  const params = await searchParams;
  const raw = params.status;
  const status = Array.isArray(raw) ? (raw[0] ?? "open") : (raw ?? "open");

  const reports = await listReports({ status });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect
          name="status"
          value={status}
          label="Report status"
          current={status ? { status } : {}}
          className="h-9 w-[10rem] text-xs"
          options={[
            { value: "open", label: "Open" },
            { value: "resolved", label: "Resolved" },
            { value: "dismissed", label: "Dismissed" },
            { value: "all", label: "All reports" },
          ]}
        />
        <span className="text-xs text-muted-foreground">{reports.length} shown</span>
      </div>

      <div className="space-y-2">
        {reports.length === 0 ? (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">
              Nothing in the moderation queue.
            </CardContent>
          </Card>
        ) : (
          reports.map((report) => (
            <Card key={report.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={
                      report.status === "open"
                        ? "destructive"
                        : report.status === "resolved"
                          ? "default"
                          : "muted"
                    }
                  >
                    {report.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    reported by @{report.reporterUsername} · {fmtDate(report.createdAt)}
                  </span>
                </div>

                <blockquote className="rounded-lg border bg-muted/40 p-3 text-sm">
                  {report.body}
                </blockquote>

                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>
                    by @{report.authorUsername} in{" "}
                    <Link className="underline" href={`/story/${report.storySlug}`}>
                      {report.storyTitle}
                    </Link>
                  </span>
                  {report.chapterTitle ? <span>· “{report.chapterTitle}”</span> : null}
                </div>

                {report.reason ? (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">Reason:</span> {report.reason}
                  </p>
                ) : null}

                <ReportActions
                  reportId={report.id}
                  commentId={report.commentId}
                  storySlug={report.storySlug}
                  storyTitle={report.storyTitle}
                />
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Button asChild size="sm" variant="ghost">
        <Link href="/admin/comments?status=all">Show every report</Link>
      </Button>
    </div>
  );
}
