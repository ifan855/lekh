export const runtime = "nodejs";

import { auth } from "@/lib/auth-server";

export default auth.middleware({
  loginUrl: "/auth/sign-in",
});

export const config = {
  matcher: [
    "/write/:path*",
    "/settings/:path*",
    "/admin/:path*",
  ],
};
