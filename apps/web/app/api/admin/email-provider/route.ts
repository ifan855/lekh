import { NextResponse } from "next/server";
import { z } from "zod";

import { getAdminViewer } from "@/app/admin/_lib/server";

export const dynamic = "force-dynamic";

/**
 * Email delivery for Neon Auth (Resend over SMTP).
 *
 * Neon Auth sends the one-time codes, so the sender is configured on the Neon
 * branch rather than in lekh itself. This route is a thin, admin-only wrapper
 * around the Neon API and the Resend API:
 *
 *   PATCH /api/v2/projects/{project}/branches/{branch}/auth/email_provider
 *   GET|POST https://api.resend.com/domains
 */

const NEON_API = "https://console.neon.tech/api/v2";
const RESEND_API = "https://api.resend.com";

type ResendRecord = {
  type: string;
  name: string;
  value: string;
  status?: string;
  priority?: number;
};

type ResendDomain = {
  id: string;
  name: string;
  status: string;
  region?: string;
  records?: ResendRecord[];
};

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

async function listResendDomains(): Promise<{ domains: ResendDomain[]; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { domains: [], error: "RESEND_API_KEY is not set." };

  const res = await fetch(`${RESEND_API}/domains`, {
    headers: { authorization: `Bearer ${apiKey}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { domains: [], error: body?.message ?? "Could not reach Resend." };
  }
  return { domains: (body?.data ?? []) as ResendDomain[] };
}

/** Current provider + sending domains. */
export async function GET() {
  const viewer = await getAdminViewer();
  if (!viewer) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const config = neonConfig();
  let provider: unknown = null;
  let providerError: string | null = null;

  if (!config) {
    providerError =
      "Set NEON_API_KEY, NEON_PROJECT_ID and NEON_BRANCH_ID to manage email delivery from lekh.";
  } else {
    const res = await fetch(neonUrl(config, "/email_provider"), {
      headers: { authorization: `Bearer ${config.apiKey}` },
    });
    provider = await res.json().catch(() => null);
    if (!res.ok) providerError = "Could not read the Neon email provider configuration.";
  }

  const { domains, error } = await listResendDomains();

  return NextResponse.json({
    provider,
    providerError,
    domains,
    resendError: error ?? null,
    resendFrom: process.env.RESEND_FROM_EMAIL ?? null,
  });
}

const patchSchema = z.object({
  resendApiKey: z.string().trim().min(8),
  senderEmail: z.string().trim().email(),
  senderName: z.string().trim().min(1).max(120).optional(),
});

/** Point the Neon branch's SMTP provider at Resend. */
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
      { error: "A Resend API key and a verified sender address are required." },
      { status: 400 },
    );
  }
  const { resendApiKey, senderEmail, senderName } = parsed.data;

  const res = await fetch(neonUrl(config, "/email_provider"), {
    method: "PATCH",
    headers: {
      authorization: `Bearer ${config.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      type: "standard",
      host: "smtp.resend.com",
      port: 587,
      username: "resend",
      password: resendApiKey,
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

const verifySchema = z.object({ domainId: z.string().min(1) });

/** Ask Resend to re-check the DNS records of a domain. */
export async function PUT(request: Request) {
  const viewer = await getAdminViewer();
  if (!viewer) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "RESEND_API_KEY is not set." }, { status: 400 });

  const parsed = verifySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "A domain id is required." }, { status: 400 });

  const res = await fetch(`${RESEND_API}/domains/${parsed.data.domainId}/verify`, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json({ error: body?.message ?? "Verification failed" }, { status: res.status });
  }
  return NextResponse.json({ ok: true, domain: body });
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
