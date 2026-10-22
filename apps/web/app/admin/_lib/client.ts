"use client";

import { toast } from "sonner";

export type AdminResult = { ok: true; data: unknown } | { ok: false; error: string };

/** Small JSON helper for the admin client forms. */
export async function adminRequest(
  url: string,
  method: "POST" | "PATCH" | "DELETE" | "PUT",
  body?: unknown,
): Promise<AdminResult> {
  try {
    const response = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const data: unknown = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message =
        data && typeof data === "object" && "error" in data && typeof data.error === "string"
          ? data.error
          : `Request failed (${response.status})`;
      return { ok: false, error: message };
    }
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Network error" };
  }
}

export function reportError(error: string) {
  toast.error(error);
}
