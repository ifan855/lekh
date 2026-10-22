import { createNeonAuth } from "@neondatabase/auth/next/server";

/**
 * Neon Auth (Managed Better Auth) server instance.
 *
 * The auth server proxies every Better Auth endpoint, so sessions live on our
 * own domain. Password auth is disabled on the Neon side — lekh is passwordless
 * and uses email one-time codes.
 */
export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL ?? "https://example.invalid/neondb/auth",
  cookies: {
    secret:
      process.env.NEON_AUTH_COOKIE_SECRET ?? "lekh-development-cookie-secret-change-me-32chars",
    sameSite: "lax",
  },
});
