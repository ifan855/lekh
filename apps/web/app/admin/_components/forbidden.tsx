import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Shown to signed-in members that are not admins (HTTP 403 semantics). */
export function Forbidden({ message }: { message?: string }) {
  return (
    <Card className="mx-auto mt-10 max-w-md">
      <CardHeader>
        <CardTitle>403 — admins only</CardTitle>
        <CardDescription>
          {message ??
            "This area is reserved for lekh moderators. Your account does not have administrator access."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild variant="outline" size="sm">
          <Link href="/">Back to lekh</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
