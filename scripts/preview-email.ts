/**
 * Render the email template to a file you can open in a browser — no sending.
 * Usage: npx tsx scripts/preview-email.ts
 * Then open the generated email-preview.html
 */
import { writeFileSync } from "node:fs";
import { config } from "dotenv";
import { renderEmailHtml } from "../src/lib/email-template";

config({ path: ".env.local" });
config({ path: ".env" });

const html = renderEmailHtml({
  title: "Purchase proposal for 2026-27",
  message:
    "Dear Sir/Madam,\n\nPlease find below the proposal for the purchase of non-consumable equipment for the Department of Computer Engineering.\n\nThe total estimated expenditure is Rs. 1,25,000/-. The Essentiality Certificate, Justification Report and K.F.C. Form 13 are attached for your reference.\n\nKindly do the needful.",
  senderName: "Amrutha Mohan",
  senderRole: "Demonstrator in CT",
  attachments: ["KFC-Form-13.pdf", "Essentiality-Certificate.pdf"],
});

writeFileSync("email-preview.html", html, "utf8");
console.log("✔ Wrote email-preview.html — open it in a browser to see the template.");
