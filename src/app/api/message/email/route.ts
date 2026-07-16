import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { getMailTransport, mailFrom } from "@/lib/mailer";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Send a plain-text (or simple HTML) email via the configured SMTP server.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { to?: string; subject?: string; message?: string };
  const to = String(body.to ?? "").trim();
  const subject = String(body.subject ?? "").trim();
  const message = String(body.message ?? "").trim();

  // Allow multiple comma/semicolon-separated recipients.
  const recipients = to.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  if (recipients.length === 0)
    return NextResponse.json({ success: false, message: "A recipient email is required" }, { status: 400 });
  const bad = recipients.find((r) => !EMAIL_RE.test(r));
  if (bad) return NextResponse.json({ success: false, message: `Invalid email address: ${bad}` }, { status: 400 });
  if (!message)
    return NextResponse.json({ success: false, message: "Message body is required" }, { status: 400 });

  const transport = getMailTransport();
  if (!transport)
    return NextResponse.json(
      { success: false, message: "Email is not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASS in .env." },
      { status: 400 }
    );

  try {
    await transport.sendMail({
      from: mailFrom(),
      to: recipients,
      subject: subject || "(no subject)",
      text: message,
      // Preserve line breaks in a minimal HTML alternative.
      html: message.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br>"),
    });
    return NextResponse.json({ success: true, message: `Email sent to ${recipients.length} recipient(s).` });
  } catch (e) {
    return NextResponse.json({ success: false, message: `Send failed: ${(e as Error).message}` }, { status: 500 });
  }
}
