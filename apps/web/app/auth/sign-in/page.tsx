import { Suspense } from "react";
import Link from "next/link";

import { SignInForm } from "@/components/auth/sign-in-form";

export const metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <div className="min-h-[70dvh]">
      <Suspense fallback={null}>
        <SignInForm />
      </Suspense>
      <p className="px-5 text-center text-xs text-muted-foreground">
        By continuing you agree to keep lekh kind. <Link href="/" className="underline">Back home</Link>
      </p>
    </div>
  );
}
