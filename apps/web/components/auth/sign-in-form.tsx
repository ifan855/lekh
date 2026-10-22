"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Mail, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Step = "email" | "code";

export function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/";

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const sendCode = async () => {
    if (!email.includes("@")) {
      toast.error("Enter a valid email address");
      return;
    }
    setPending(true);
    try {
      const res = await fetch("/api/auth/email-otp/send-verification-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, type: "sign-in" }),
      });
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(detail || "Could not send the code");
      }
      setStep("code");
      setCooldown(45);
      toast.success("Check your inbox — the code is on its way");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send the code");
    } finally {
      setPending(false);
    }
  };

  const verify = async () => {
    if (code.trim().length < 4) {
      toast.error("Enter the code from your email");
      return;
    }
    setPending(true);
    try {
      const res = await fetch("/api/auth/sign-in/email-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, otp: code.trim(), type: "sign-in" }),
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      toast.success("Welcome to lekh");
      router.push(next);
      router.refresh();
    } catch {
      toast.error("That code did not work. Try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[70dvh] w-full max-w-sm flex-col justify-center px-5 py-10">
      {step === "email" ? (
        <>
          <div className="mb-6 text-center">
            <h1 className="font-serif text-2xl font-semibold tracking-tight">Welcome to lekh</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              No passwords. We&apos;ll email you a one-time code.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void sendCode();
                }}
                placeholder="you@example.com"
                autoFocus
              />
            </div>

            <Button className="w-full" size="lg" onClick={sendCode} disabled={pending}>
              <Mail className="h-4 w-4" />
              {pending ? "Sending…" : "Send me a code"}
            </Button>
          </div>
        </>
      ) : (
        <>
          <button
            type="button"
            className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground"
            onClick={() => setStep("email")}
          >
            <ArrowLeft className="h-4 w-4" />
            Use a different email
          </button>

          <div className="mb-6 text-center">
            <ShieldCheck className="mx-auto h-8 w-8 text-primary" />
            <h1 className="mt-3 font-serif text-2xl font-semibold tracking-tight">Enter your code</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              We sent a one-time code to <span className="text-foreground">{email}</span>.
            </p>
          </div>

          <div className="space-y-4">
            <Input
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 8))}
              onKeyDown={(event) => {
                if (event.key === "Enter") void verify();
              }}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              className="h-14 text-center text-2xl tracking-[0.5em]"
              autoFocus
            />

            <Button className="w-full" size="lg" onClick={verify} disabled={pending}>
              {pending ? "Checking…" : "Continue"}
            </Button>

            <Button
              variant="ghost"
              className="w-full"
              disabled={cooldown > 0 || pending}
              onClick={sendCode}
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Send a new code"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
