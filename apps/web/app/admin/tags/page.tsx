import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TagManager } from "@/app/admin/_components/tag-manager";
import { Forbidden } from "@/app/admin/_components/forbidden";
import { listTags } from "@/app/admin/_lib/data";
import { getAdminViewer } from "@/app/admin/_lib/server";

export const metadata = { title: "Tags · Admin" };

export default async function AdminTagsPage() {
  const viewer = await getAdminViewer();
  if (!viewer) return <Forbidden />;

  const tags = await listTags();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Tags</CardTitle>
          <CardDescription className="text-xs">
            Every distinct tag in use, with the number of stories carrying it. Rename a tag across
            all stories, fold one tag into another, or remove it entirely.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TagManager tags={tags} />
        </CardContent>
      </Card>
    </div>
  );
}
