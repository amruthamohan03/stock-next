/**
 * Verify the SMTP settings in .env, and optionally send a test email.
 *   npx tsx scripts/test-mail.ts                 → just check the connection
 *   npx tsx scripts/test-mail.ts you@gmail.com   → also send a test message
 */
import nodemailer from "nodemailer";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM } = process.env;

function mask(v?: string) {
  if (!v) return "EMPTY";
  return `set (${v.length} chars)`;
}

async function main() {
  console.log("SMTP_HOST:", SMTP_HOST || "EMPTY");
  console.log("SMTP_PORT:", SMTP_PORT || "EMPTY");
  console.log("SMTP_USER:", SMTP_USER || "EMPTY");
  console.log("SMTP_PASS:", mask(SMTP_PASS));

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.error("\n✖ Not configured: SMTP_HOST, SMTP_USER and SMTP_PASS must all be set in .env");
    process.exit(1);
  }

  const port = Number(SMTP_PORT ?? 587);
  const transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  try {
    await transport.verify();
    console.log("\n✔ SMTP connection + login OK.");
  } catch (e) {
    console.error("\n✖ SMTP check failed:", (e as Error).message);
    console.error("  Gmail? Use an App Password (Security > 2-Step Verification > App passwords).");
    process.exit(1);
  }

  const to = process.argv[2];
  if (!to) {
    console.log("\nTip: pass an address to send a test — npx tsx scripts/test-mail.ts you@gmail.com");
    return;
  }

  await transport.sendMail({
    from: MAIL_FROM?.trim() || SMTP_USER,
    to,
    subject: "Test from Stock Management",
    text: "If you can read this, email sending from the app works.",
  });
  console.log(`✔ Test email sent to ${to}`);
}

main().catch((e) => {
  console.error("✖ Failed:", e.message);
  process.exit(1);
});
