import { NextResponse } from "next/server";
import { z } from "zod";

import { getAdminViewer } from "@/app/admin/_lib/server";

export const dynamic = "force-dynamic";

/**
 * Neon Auth email provider (Resend over SMTP).
 *
 * Neon Auth sends the one-time codes, so the sender is configured on the Neon
 * branch rather than in lekh itself. This route is a thin, admin-only wrapper
 * around the Neon API:
 *   PATCH /api/v2/projects/{project}/branches/{branch}/auth/email_provider
 */

const NEON_API = "https://console.neon.tech/api/v2";

function neonConfig() {
  const apiKey = process.env.NEON_API_KEY;
  const projectId = process.env.NEON_PROJECT_ID;
  const branchId = process.env.NEON_BRANCH_ID;
  if (!apiKey || !projectId || !branchId) return null;
  return { apiKey, projectId, branchId };
}

export async function GET() {
  const viewer = await getAdminViewer();
  if (!viewer) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const config = neonConfig();
  if (!config) {
    return NextResponse.json({
      configured: false,
      message:
        "Set NEON_API_KEY, NEON_PROJECT_ID and NEON_BRANCH_ID to manage email delivery from lekh.",
    });
  }

  const res = await fetch(
    `${NEON_API}/projects/${config.projectId}/branches/${config.branchId}/auth/email_provider`,
    { headers: { authorization: `Bearer ${config.apiKey}` } },
  );
  const body = await res.json().catch(() => ({}));
  return NextResponse.json({ configured: true, provider: body }, { status: res.status });
}

const patchSchema = z.object({
  resendApiKey: z.string().trim().min(8),
  senderEmail: z.string().trim().email(),
  senderName: z.string().trim().min(1).max(120).optional(),
});

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
    return NextResponse.json({ error: "A Resend API key and a verified sender are required." }, { status: 400 });
  }
  const { resendApiKey, senderEmail, senderName } = parsed.data;

  const res = await fetch(
    `${NEON_API}/projects/${config.projectId}/branches/${config.branchId}/auth/email_provider`,
    {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        type: "standard",
        host: "smtp.resend.com",
        port: 465,
        username: "resend",
        password: resendApiKey,
        sender_email: senderEmail,
        sender_name: senderName || "lekh",
      }),
    },
  );

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

export async function POST(request: Request) {
  const viewer = await getAdminViewer();
  if (!viewer) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const config = neonConfig();
  if (!config) {
    return NextResponse.json({ error: "Neon API access is not configured." }, { status: 400 });
  }

  const parsed = testSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "A valid recipient is required." }, { status: 400 });

  const res = await fetch(
    `${NEON_API}/projects/${config.projectId}/branches/${config.branchId}/auth/send_test_email`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ recipient_email: parsed.data.recipientEmail }),
    },
  );
  const body = await res.json().catch(() => ({}));
  return NextResponse.json(
    res.ok ? { ok: true } : { error: body?.message ?? "Could not send the test email." },
    { status: res.status },
  );
}
