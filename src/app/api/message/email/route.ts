import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { getMailTransport, mailFrom } from "@/lib/mailer";
import { renderEmailHtml } from "@/lib/email-template";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Most SMTP providers reject much beyond ~25 MB once base64-encoded, so cap
// the raw total well under that.
const MAX_TOTAL_BYTES = 15 * 1024 * 1024;

/** Strip path separators / control chars so the attachment name is safe. */
const safeName = (name: string) =>
  (name || "attachment")
    .replace(/[\\/]/g, "_")
    .replace(/[\x00-\x1f]/g, "")
    .trim()
    .slice(0, 200) || "attachment";

const mb = (n: number) => (n / (1024 * 1024)).toFixed(1);

// Send an email (branded HTML + plain text) with optional file attachments.
// Accepts multipart/form-data: to, subject, message, files[]
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const to = String(form.get("to") ?? "").trim();
  const subject = String(form.get("subject") ?? "").trim();
  const message = String(form.get("message") ?? "").trim();
  const messageHtml = String(form.get("messageHtml") ?? "").trim();

  // Allow multiple comma/semicolon-separated recipients.
  const recipients = to.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  if (recipients.length === 0)
    return NextResponse.json({ success: false, message: "A recipient email is required" }, { status: 400 });
  const bad = recipients.find((r) => !EMAIL_RE.test(r));
  if (bad) return NextResponse.json({ success: false, message: `Invalid email address: ${bad}` }, { status: 400 });
  if (!message)
    return NextResponse.json({ success: false, message: "Message body is required" }, { status: 400 });

  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  const total = files.reduce((s, f) => s + f.size, 0);
  if (total > MAX_TOTAL_BYTES)
    return NextResponse.json(
      { success: false, message: `Attachments total ${mb(total)} MB — the limit is ${mb(MAX_TOTAL_BYTES)} MB.` },
      { status: 400 }
    );

  const transport = getMailTransport();
  if (!transport)
    return NextResponse.json(
      { success: false, message: "Email is not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASS in .env." },
      { status: 400 }
    );

  try {
    const attachments = await Promise.all(
      files.map(async (f) => ({
        filename: safeName(f.name),
        content: Buffer.from(await f.arrayBuffer()),
        contentType: f.type || undefined,
      }))
    );

    await transport.sendMail({
      from: mailFrom(),
      to: recipients,
      subject: subject || "(no subject)",
      // Plain-text part for clients that don't render HTML.
      text: message,
      html: renderEmailHtml({
        title: subject,
        message,
        messageHtml,
        senderName: session.fullName,
        senderRole: session.roleName,
        attachments: attachments.map((a) => a.filename),
      }),
      attachments,
    });

    const suffix = attachments.length ? ` with ${attachments.length} attachment(s)` : "";
    return NextResponse.json({
      success: true,
      message: `Email sent to ${recipients.length} recipient(s)${suffix}.`,
    });
  } catch (e) {
    return NextResponse.json({ success: false, message: `Send failed: ${(e as Error).message}` }, { status: 500 });
  }
}
