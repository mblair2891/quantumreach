import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth/better-auth";

/** Server-side sign-out that clears Better Auth cookies, then returns to funnel. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = url.searchParams.get("next");
  const destination = next && next.startsWith("/") && !next.startsWith("//") ? next : "/start";

  try {
    await auth.api.signOut({ headers: headers() });
  } catch {
    // Continue to redirect even if session already absent.
  }

  const response = NextResponse.redirect(new URL(destination, url.origin));
  // Best-effort clear common Better Auth cookie names.
  for (const name of [
    "better-auth.session_token",
    "__Secure-better-auth.session_token",
    "better-auth.session_data",
    "__Secure-better-auth.session_data",
  ]) {
    response.cookies.set(name, "", { path: "/", maxAge: 0 });
  }
  return response;
}
