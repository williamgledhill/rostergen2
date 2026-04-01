import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const SESSION_COOKIE_NAME = "roster_session";

function isPublicPath(pathname: string) {
  return pathname === "/" || pathname.startsWith("/signup");
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/public") ||
    pathname === "/favicon.ico" ||
    /\.[a-zA-Z0-9]+$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  const hasSessionCookie = Boolean(request.cookies.get(SESSION_COOKIE_NAME)?.value);

  if (!isPublicPath(pathname) && !hasSessionCookie) {
    const redirectUrl = new URL("/signup", request.url);
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (pathname.startsWith("/signup") && hasSessionCookie) {
    return NextResponse.redirect(new URL("/editor", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/:path*"],
};
