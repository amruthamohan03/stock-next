import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

/**
 * Who the bearer token belongs to.
 *
 * The mobile app calls this on launch to decide whether its stored token is
 * still good: a 401 means "show the login screen", a 200 means "go straight in"
 * and refreshes the cached user (name, role) in one call.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, message: "Your session has expired. Please sign in again." },
      { status: 401 }
    );
  }
  return NextResponse.json({ success: true, message: "", user: session });
}
