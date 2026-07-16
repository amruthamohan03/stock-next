import nodemailer, { type Transporter } from "nodemailer";

/**
 * Build a nodemailer transport from the SMTP_* env vars, or return null when
 * email isn't configured (so callers can show a clear "not configured" error
 * instead of crashing). Port 465 → implicit TLS, otherwise STARTTLS.
 */
export function getMailTransport(): Transporter | null {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;

  const port = Number(SMTP_PORT ?? 587);
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

/** The From header — MAIL_FROM if set, else the authenticated SMTP user. */
export function mailFrom(): string {
  return process.env.MAIL_FROM?.trim() || process.env.SMTP_USER || "";
}
