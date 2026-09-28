import { type NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_TTL_SECONDS } from "@/lib/cookies";

/**
 * Edge middleware — cheap, DB-free checks only:
 *  1. Optimistic redirect to sign-in for private areas when no session cookie
 *     exists (the authoritative check happens server-side in each page/action).
 *  2. Sliding cookie lifetime: re-issue the session cookie on page navigations
 *     so active users are not logged out on day 30. The DB expiry is extended
 *     separately in getCurrentUser().
 */
export function middleware(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const { pathname, search } = request.nextUrl;

  if (!token && (pathname.startsWith("/account") || pathname.startsWith("/admin"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/sign-in";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  const response = NextResponse.next();
  const isPageNavigation = request.method === "GET" && request.headers.get("accept")?.includes("text/html");
  if (token && isPageNavigation) {
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    });
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/|api/|sw\\.js|pdf\\.worker|manifest\\.webmanifest|icon|favicon|robots\\.txt|sitemap\\.xml|offline-shell).*)"],
};
