import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

const protectedPrefixes = ["/dashboard", "/onboarding", "/platform", "/portal"];

function isProtectedPath(pathname: string) {
  return protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function middleware(request: NextRequest) {
  if (!isProtectedPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  // Edge-safe cookie presence check. Full session validation happens in requireUserProfile.
  const sessionToken = getSessionCookie(request);
  if (!sessionToken) {
    const signIn = new URL("/sign-in", request.url);
    const next = `${request.nextUrl.pathname}${request.nextUrl.search}`;
    if (next && next !== "/") signIn.searchParams.set("next", next);
    return NextResponse.redirect(signIn);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
