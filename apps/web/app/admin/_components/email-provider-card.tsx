"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Info, Mail, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ProviderState = {
  configured?: boolean;
  message?: string | null;
  provider?: {
    type?: string;
    host?: string;
    port?: number;
    username?: string;
    sender_email?: string;
    sender_name?: string;
  } | null;
};

const PRESETS = [
  { id: "gmail", label: "Gmail", host: "smtp.gmail.com", port: 587 },
  { id: "outlook", label: "Outlook / Microsoft 365", host: "smtp.office365.com", port: 587 },
  { id: "yahoo", label: "Yahoo Mail", host: "smtp.mail.yahoo.com", port: 587 },
  { id: "custom", label: "Other (SMTP)", host: "", port: 587 },
];

/**
 * Email delivery.
 *
 * lekh never sends mail itself — Neon Auth sends the one-time codes through
 * the SMTP provider configured on the Neon branch. This panel writes that
 * configuration straight into Neon, so nothing about email lives in the web
 * app's own environment.
 */
export function EmailProviderCard() {
  const [state, setState] = useState<ProviderState | null>(null);
  const [preset, setPreset] = useState("gmail");
  const [host, setHost] = useState("smtp.gmail.com");
  const [port, setPort] = useState("587");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
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
      if (body.provider) {
        if (body.provider.host) setHost(body.provider.host);
        if (body.provider.port) setPort(String(body.provider.port));
        if (body.provider.username) setUsername(body.provider.username);
        if (body.provider.sender_email) setSenderEmail(body.provider.sender_email);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const applyPreset = (id: string) => {
    setPreset(id);
    const found = PRESETS.find((p) => p.id === id);
    if (found && found.host) {
      setHost(found.host);
      setPort(String(found.port));
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/email-provider", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          smtpHost: host,
          smtpPort: Number(port),
          username,
          password,
          senderEmail: senderEmail || username,
          senderName,
        }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Could not save the email provider");
      toast.success("Email provider updated — one-time codes will be sent through this mailbox");
      setPassword("");
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-4 w-4" />
          Email delivery
        </CardTitle>
        <CardDescription>
          One-time codes are sent by Neon Auth through an SMTP provider. Configure the mailbox here
          and the credentials are stored in Neon — never in the web app&apos;s environment.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {state?.message && (
          <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
            {state.message}
          </p>
        )}

        {state?.provider?.host && (
          <p className="text-xs text-muted-foreground">
            Currently sending from <span className="text-foreground">{state.provider.sender_email}</span>{" "}
            via {state.provider.host}:{state.provider.port}.
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Mailbox</Label>
            <Select value={preset} onValueChange={applyPreset}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRESETS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="smtp-host">SMTP host</Label>
            <Input
              id="smtp-host"
              value={host}
              onChange={(event) => setHost(event.target.value)}
              placeholder="smtp.gmail.com"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="smtp-port">Port</Label>
            <Input
              id="smtp-port"
              value={port}
              onChange={(event) => setPort(event.target.value.replace(/\D/g, "").slice(0, 5))}
              inputMode="numeric"
              placeholder="587"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="smtp-user">Username</Label>
            <Input
              id="smtp-user"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="you@gmail.com"
              autoComplete="username"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="smtp-pass">App password</Label>
            <Input
              id="smtp-pass"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="16-character app password"
              autoComplete="new-password"
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

        <div className="space-y-1.5">
          <Label htmlFor="sender-email">Sender address</Label>
          <Input
            id="sender-email"
            type="email"
            value={senderEmail}
            onChange={(event) => setSenderEmail(event.target.value)}
            placeholder="you@gmail.com"
          />
        </div>

        <div className="flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            For Gmail: turn on 2-Step Verification, then create an{" "}
            <a
              className="underline"
              href="https://myaccount.google.com/apppasswords"
              target="_blank"
              rel="noreferrer"
            >
              app password
            </a>{" "}
            (16 characters, no spaces). Your normal Google password will not work. Port 587 uses
            STARTTLS; switch to 465 only if 587 is blocked.
          </span>
        </div>

        <Button onClick={save} disabled={busy || !host || !username || !password || !senderEmail}>
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
      </CardContent>
    </Card>
  );
}
