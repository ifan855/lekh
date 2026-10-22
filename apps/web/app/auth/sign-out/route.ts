import { NextResponse } from "next/server";

import { auth } from "@/lib/auth-server";

export async function GET(request: Request) {
  try {
    await auth.signOut();
  } catch {
    /* ignore */
  }
  const url = new URL("/", request.url);
  return NextResponse.redirect(url);
}
