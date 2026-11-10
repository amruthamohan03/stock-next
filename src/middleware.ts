import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, bearerToken, verifySessionToken } from "@/lib/session";

const PUBLIC_PATHS = ["/login", "/_next", "/favicon.ico", "/api/auth/login"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Browser → session cookie; mobile app → Authorization: Bearer <jwt>.
  const token = req.cookies.get(SESSION_COOKIE)?.value ?? bearerToken(req.headers);
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    // An API caller can do nothing with a login *page*: a native client would
    // try to parse HTML as JSON, and `apiRequest` already maps a 401 to
    // "Your session has expired."
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { success: false, message: "Your session has expired. Please sign in again." },
        { status: 401 }
      );
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Protect everything except static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
