"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Mail, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Email delivery (Resend).
 *
 * lekh does not send the codes itself — Neon Auth does, using an SMTP provider
 * configured on the Neon branch. This panel points that provider at Resend.
 */
export function EmailProviderCard() {
  const [apiKey, setApiKey] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [senderName, setSenderName] = useState("lekh");
  const [recipient, setRecipient] = useState("");
  const [busy, setBusy] = useState(false);

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
      <CardContent className="space-y-4">
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
            <Label htmlFor="sender-email">Sender email</Label>
            <Input
              id="sender-email"
              type="email"
              value={senderEmail}
              onChange={(event) => setSenderEmail(event.target.value)}
              placeholder="lekh@yourdomain.com"
            />
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

        <p className="text-xs text-muted-foreground">
          Requires NEON_API_KEY, NEON_PROJECT_ID and NEON_BRANCH_ID in the environment. The sender
          domain must already be verified in Resend.
        </p>
      </CardContent>
    </Card>
  );
}
