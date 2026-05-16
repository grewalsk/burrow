import { NextRequest, NextResponse } from "next/server";

// Ensure every request has a burrow_session cookie. Lets browser fetch() calls
// carry a session without client-side cookie juggling.
export function middleware(req: NextRequest) {
  const existing = req.cookies.get("burrow_session")?.value;
  if (existing) return NextResponse.next();

  const id = crypto.randomUUID();
  const res = NextResponse.next();
  res.cookies.set("burrow_session", id, {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

export const config = {
  matcher: [
    // Run on every route except Next internals and static assets.
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
