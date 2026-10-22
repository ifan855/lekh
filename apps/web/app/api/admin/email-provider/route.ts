import { NextResponse } from "next/server";
import { z } from "zod";

import { getAdminViewer } from "@/app/admin/_lib/server";

export const dynamic = "force-dynamic";

/**
 * Email delivery for Neon Auth.
 *
 * lekh never sends mail itself: Neon Auth sends the one-time codes through the
 * SMTP provider configured on the Neon branch. This route is a thin, admin-only
 * wrapper around the Neon API:
 *
 *   GET|PATCH /api/v2/projects/{project}/branches/{branch}/auth/email_provider
 *   POST      /api/v2/projects/{project}/branches/{branch}/auth/send_test_email
 *
 * The password never touches lekh's own environment — it goes straight from
 * this request into Neon's configuration.
 */

const NEON_API = "https://console.neon.tech/api/v2";

function neonConfig() {
  const apiKey = process.env.NEON_API_KEY;
  const projectId = process.env.NEON_PROJECT_ID;
  const branchId = process.env.NEON_BRANCH_ID;
  if (!apiKey || !projectId || !branchId) return null;
  return { apiKey, projectId, branchId };
}

function neonUrl(config: { projectId: string; branchId: string }, path: string): string {
  return `${NEON_API}/projects/${config.projectId}/branches/${config.branchId}/auth${path}`;
}

/** Current SMTP provider. */
export async function GET() {
  const viewer = await getAdminViewer();
  if (!viewer) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const config = neonConfig();
  if (!config) {
    return NextResponse.json({
      configured: false,
      provider: null,
      message:
        "Set NEON_API_KEY, NEON_PROJECT_ID and NEON_BRANCH_ID to manage email delivery from lekh.",
    });
  }

  const res = await fetch(neonUrl(config, "/email_provider"), {
    headers: { authorization: `Bearer ${config.apiKey}` },
  });
  const body = await res.json().catch(() => null);

  return NextResponse.json({
    configured: true,
    provider: body,
    message: res.ok ? null : "Could not read the Neon email provider configuration.",
  });
}

const patchSchema = z.object({
  smtpHost: z.string().trim().min(3).max(200),
  smtpPort: z.number().int().min(1).max(65535),
  username: z.string().trim().min(1).max(200),
  password: z.string().min(4).max(400),
  senderEmail: z.string().trim().email(),
  senderName: z.string().trim().min(1).max(120).optional(),
});

/** Point the Neon branch's SMTP provider at a mailbox (Gmail, Resend, SES…). */
export async function PATCH(request: Request) {
  const viewer = await getAdminViewer();
  if (!viewer) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const config = neonConfig();
  if (!config) {
    return NextResponse.json(
      { error: "NEON_API_KEY, NEON_PROJECT_ID and NEON_BRANCH_ID are not configured." },
      { status: 400 },
    );
  }

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Host, port, user, password and a sender address are required." },
      { status: 400 },
    );
  }
  const { smtpHost, smtpPort, username, password, senderEmail, senderName } = parsed.data;

  const res = await fetch(neonUrl(config, "/email_provider"), {
    method: "PATCH",
    headers: {
      authorization: `Bearer ${config.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      type: "standard",
      host: smtpHost,
      port: smtpPort,
      username,
      password,
      sender_email: senderEmail,
      sender_name: senderName || "lekh",
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json(
      { error: body?.message ?? "Neon rejected the email provider configuration." },
      { status: res.status },
    );
  }
  return NextResponse.json({ ok: true, provider: body });
}

const testSchema = z.object({ recipientEmail: z.string().trim().email() });

/** Send a test email through the configured provider. */
export async function POST(request: Request) {
  const viewer = await getAdminViewer();
  if (!viewer) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const config = neonConfig();
  if (!config) {
    return NextResponse.json({ error: "Neon API access is not configured." }, { status: 400 });
  }

  const parsed = testSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "A valid recipient is required." }, { status: 400 });

  const res = await fetch(neonUrl(config, "/send_test_email"), {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ recipient_email: parsed.data.recipientEmail }),
  });
  const body = await res.json().catch(() => ({}));
  return NextResponse.json(
    res.ok ? { ok: true } : { error: body?.message ?? "Could not send the test email." },
    { status: res.status },
  );
}
