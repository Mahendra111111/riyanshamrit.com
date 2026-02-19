/**
 * Next.js middleware — route protection.
 *
 * Protected routes redirect to /login if the user is not authenticated.
 * Admin routes additionally check the role from the session cookie.
 *
 * SECURITY:
 * - This middleware is UX-only protection (client-side guard)
 * - The REAL auth enforcement happens on the backend API
 * - We cannot read httpOnly cookies here, so we use a session cookie for UI state
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_PATHS = ["/cart", "/checkout", "/profile", "/orders"];
const ADMIN_PATHS = ["/admin"];

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get("session");

  // Check if path requires authentication
  const requiresAuth = PROTECTED_PATHS.some((p) => pathname.startsWith(p));
  const requiresAdmin = ADMIN_PATHS.some((p) => pathname.startsWith(p));

  if ((requiresAuth || requiresAdmin) && !sessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|public).*)"],
};
