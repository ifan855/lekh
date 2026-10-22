"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Copy, Mail, RefreshCw, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ResendDomain = {
  id: string;
  name: string;
  status: string;
  region?: string;
  records?: { type: string; name: string; value: string; status?: string; priority?: number }[];
};

type ProviderState = {
  provider?: {
    type?: string;
    host?: string;
    port?: number;
    username?: string;
    sender_email?: string;
    sender_name?: string;
  } | null;
  providerError?: string | null;
  domains?: ResendDomain[];
  resendError?: string | null;
  resendFrom?: string | null;
};

const STATUS_COPY: Record<string, { label: string; tone: string }> = {
  verified: { label: "Verified — ready to send", tone: "text-primary" },
  pending: { label: "Waiting for DNS to propagate", tone: "text-amber-600" },
  not_started: { label: "DNS records not added yet", tone: "text-amber-600" },
  failure: { label: "Verification failed — check the records", tone: "text-destructive" },
};

/**
 * Email delivery (Resend).
 *
 * lekh does not send the codes itself — Neon Auth does, through an SMTP
 * provider configured on the Neon branch. This panel points that provider at
 * Resend and shows which sending domains are ready.
 */
export function EmailProviderCard() {
  const [state, setState] = useState<ProviderState | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [senderName, setSenderName] = useState("lekh");
  const [recipient, setRecipient] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/email-provider");
      if (!res.ok) return;
      const body = (await res.json()) as ProviderState;
      setState(body);
      if (body.provider?.sender_email && !senderEmail) setSenderEmail(body.provider.sender_email);
    } catch {
      /* ignore */
    }
  }, [senderEmail]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/email-provider", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resendApiKey: apiKey, senderEmail, senderName }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Could not save the email provider");
      toast.success("Email provider updated — one-time codes will be sent by Resend");
      setApiKey("");
      void load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the email provider");
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    if (!recipient) {
      toast.error("Add an address to send the test to");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/email-provider", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ recipientEmail: recipient }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Could not send the test email");
      toast.success("Test email sent");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send the test email");
    } finally {
      setBusy(false);
    }
  };

  const verifyDomain = async (domainId: string) => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/email-provider", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domainId }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Verification failed");
      toast.success("Resend is re-checking the records — give DNS a few minutes");
      void load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  };

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Copied");
    } catch {
      toast.error("Could not copy to the clipboard");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-4 w-4" />
          Email delivery (Resend)
        </CardTitle>
        <CardDescription>
          One-time codes are delivered by Neon Auth through an SMTP provider. Point it at Resend so
          codes come from your own domain.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {state?.providerError && (
          <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
            {state.providerError}
          </p>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="resend-key">Resend API key</Label>
          <Input
            id="resend-key"
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder="re_…"
            autoComplete="off"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="sender-email">Sender address</Label>
            <Input
              id="sender-email"
              type="email"
              value={senderEmail}
              onChange={(event) => setSenderEmail(event.target.value)}
              placeholder="lekh@yourdomain.com"
            />
            <p className="text-xs text-muted-foreground">
              Must belong to a domain Resend has verified.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sender-name">Sender name</Label>
            <Input
              id="sender-name"
              value={senderName}
              onChange={(event) => setSenderName(event.target.value)}
              placeholder="lekh"
            />
          </div>
        </div>

        <Button onClick={save} disabled={busy || !apiKey || !senderEmail}>
          {busy ? "Saving…" : "Save email provider"}
        </Button>

        <div className="flex flex-wrap items-end gap-2 border-t pt-4">
          <div className="min-w-[220px] flex-1 space-y-1.5">
            <Label htmlFor="test-recipient">Send a test email to</Label>
            <Input
              id="test-recipient"
              type="email"
              value={recipient}
              onChange={(event) => setRecipient(event.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <Button variant="outline" onClick={sendTest} disabled={busy}>
            <Send className="h-4 w-4" />
            Send test
          </Button>
        </div>

        {state && state.domains && state.domains.length > 0 && (
          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Resend sending domains</p>
              <Button variant="ghost" size="xs" onClick={load} disabled={busy}>
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
              </Button>
            </div>

            {state.domains.map((domain) => {
              const status = STATUS_COPY[domain.status] ?? {
                label: domain.status,
                tone: "text-muted-foreground",
              };
              const ready = domain.status === "verified";
              return (
                <div key={domain.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{domain.name}</span>
                    <span className={`text-xs ${status.tone}`}>
                      {ready ? (
                        <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />
                      ) : (
                        <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />
                      )}
                      {status.label}
                    </span>
                    {!ready && (
                      <Button
                        variant="outline"
                        size="xs"
                        className="ml-auto"
                        disabled={busy}
                        onClick={() => verifyDomain(domain.id)}
                      >
                        Check records
                      </Button>
                    )}
                  </div>

                  {!ready && domain.records && domain.records.length > 0 && (
                    <ul className="mt-3 space-y-2">
                      {domain.records.map((record) => (
                        <li key={`${record.type}-${record.name}`} className="text-xs">
                          <span className="font-medium">{record.type}</span>{" "}
                          <span className="text-muted-foreground">
                            {record.name} → {record.value}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Copy record"
                            onClick={() => copy(`${record.name} ${record.value}`)}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}

            <p className="text-xs text-muted-foreground">
              Add these DNS records at your domain registrar, then press “Check records”. Until a
              domain is verified, Resend only delivers to the account owner&apos;s own address.
            </p>
          </div>
        )}

        {state?.resendError && (
          <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
            {state.resendError}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
