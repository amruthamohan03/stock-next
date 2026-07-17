/**
 * Server-side email template.
 *
 * Email clients strip <style> blocks and ignore modern CSS, so this uses a
 * table-based layout with inline styles and a 600px max width — the reliable
 * baseline that renders consistently in Gmail / Outlook / Apple Mail.
 */

export const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Plain text → HTML paragraphs, preserving blank-line paragraph breaks. */
function bodyToHtml(message: string): string {
  return message
    .trim()
    .split(/\n{2,}/)
    .map(
      (para) =>
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:#334155;">${escapeHtml(
          para
        ).replace(/\n/g, "<br>")}</p>`
    )
    .join("");
}

/**
 * Strip anything unsafe/unsupported from editor HTML before mailing it.
 * Mail clients drop scripts anyway, but never forward them regardless.
 */
export function sanitizeEmailHtml(html: string): string {
  return html
    .replace(/<\s*(script|style|iframe|object|embed|link|meta)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*(script|style|iframe|object|embed|link|meta)\b[^>]*\/?>/gi, "")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, "")
    .replace(/javascript:/gi, "");
}

export type EmailTemplateOptions = {
  /** Heading shown inside the email (usually the subject). */
  title?: string;
  /** The message body as plain text (newlines preserved). Used when
   *  `messageHtml` is absent, and always as the text/plain part. */
  message: string;
  /** Rich-text body from the editor. Takes precedence over `message`. */
  messageHtml?: string;
  /** Optional sign-off name, e.g. the sender's full name. */
  senderName?: string | null;
  /** Optional sign-off role/designation. */
  senderRole?: string | null;
  /** Filenames attached to the mail — listed so the reader can see them. */
  attachments?: string[];
};

/**
 * Render the branded HTML email. `APP_NAME` (env) drives the header/footer
 * label so the same template serves every mail the app sends.
 */
export function renderEmailHtml({
  title,
  message,
  messageHtml,
  senderName,
  senderRole,
  attachments = [],
}: EmailTemplateOptions): string {
  const appName = process.env.APP_NAME?.trim() || "Stock Management";
  const year = new Date().getFullYear();

  const attachmentsBlock = attachments.length
    ? `<tr><td style="padding:6px 32px 0;">
         <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 14px;">
           <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:#64748b;margin-bottom:6px;">
             Attachment${attachments.length > 1 ? "s" : ""} (${attachments.length})
           </div>
           ${attachments
             .map(
               (a) =>
                 `<div style="font-size:13px;color:#334155;line-height:1.7;">&#128206; ${escapeHtml(a)}</div>`
             )
             .join("")}
         </div>
       </td></tr>`
    : "";

  // Hidden preview line shown in the inbox list.
  const preheader = escapeHtml(message.trim().replace(/\s+/g, " ").slice(0, 120));

  const signature =
    senderName || senderRole
      ? `<tr><td style="padding:4px 32px 0;">
           <div style="border-top:1px solid #e2e8f0;margin:8px 0 0;padding-top:16px;">
             ${senderName ? `<div style="font-size:14px;font-weight:600;color:#0f172a;">${escapeHtml(senderName)}</div>` : ""}
             ${senderRole ? `<div style="font-size:13px;color:#64748b;">${escapeHtml(senderRole)}</div>` : ""}
           </div>
         </td></tr>`
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title || appName)}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9;">
    <tr>
      <td align="center" style="padding:28px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
               style="width:100%;max-width:600px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">

          <!-- Header -->
          <tr>
            <td style="background:#1e293b;padding:18px 32px;">
              <div style="font-size:16px;font-weight:700;color:#ffffff;letter-spacing:.3px;">${escapeHtml(appName)}</div>
            </td>
          </tr>

          <!-- Title -->
          ${
            title
              ? `<tr><td style="padding:26px 32px 0;">
                   <h1 style="margin:0 0 12px;font-size:19px;line-height:1.35;font-weight:700;color:#0f172a;">${escapeHtml(title)}</h1>
                 </td></tr>`
              : ""
          }

          <!-- Body -->
          <tr>
            <td style="padding:${title ? "0" : "26px"} 32px 8px;">
              ${
                messageHtml?.trim()
                  ? `<div style="font-size:15px;line-height:1.65;color:#334155;">${sanitizeEmailHtml(
                      messageHtml
                    )}</div>`
                  : bodyToHtml(message)
              }
            </td>
          </tr>

          ${attachmentsBlock}
          ${signature}

          <!-- Footer -->
          <tr>
            <td style="padding:22px 32px 26px;">
              <div style="border-top:1px solid #e2e8f0;padding-top:14px;font-size:12px;line-height:1.6;color:#94a3b8;">
                Sent from ${escapeHtml(appName)} &middot; &copy; ${year}<br>
                This is an automated message — please do not reply to this email.
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
