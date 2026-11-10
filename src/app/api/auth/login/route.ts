import { NextResponse, type NextRequest } from "next/server";
import { authenticate } from "@/lib/auth-user";
import { createSessionToken, SESSION_MAX_AGE, REMEMBER_MAX_AGE } from "@/lib/session";

/**
 * Token login for non-browser clients (the mobile app).
 *
 * The web app signs in through the `loginAction` server action, which puts the
 * same JWT in an httpOnly cookie. A native client has no cookie jar, so it
 * takes the token from here and sends it back as `Authorization: Bearer …` —
 * `getSession()` and the middleware accept either.
 *
 * This path is listed in the middleware's PUBLIC_PATHS; it is the only
 * unauthenticated API in the app, so it must stay strict about what it answers.
 */
export async function POST(req: NextRequest) {
  let body: { username?: unknown; password?: unknown; rememberMe?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Send a JSON body with a username and password." },
      { status: 400 }
    );
  }

  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");
  const rememberMe = body.rememberMe === true;

  if (!username || !password) {
    return NextResponse.json(
      { success: false, message: "Please enter your username and password." },
      { status: 400 }
    );
  }

  const user = await authenticate(username, password);
  if (!user) {
    // Same wording as the web form, and the same answer whether it was the
    // username or the password that was wrong.
    return NextResponse.json(
      { success: false, message: "Invalid username or password." },
      { status: 401 }
    );
  }

  const maxAge = rememberMe ? REMEMBER_MAX_AGE : SESSION_MAX_AGE;
  return NextResponse.json({
    success: true,
    message: `Signed in as ${user.fullName || user.username}.`,
    token: await createSessionToken(user, rememberMe),
    expiresAt: new Date(Date.now() + maxAge * 1000).toISOString(),
    user,
  });
}
