/**
 * Shared helpers for validating uploaded image/PDF files (bills, attachments).
 * The MIME type is decided by sniffing the file's own bytes — never trusting
 * the browser-supplied `file.type`, which is spoofable.
 */

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

/** Canonical MIME → extension for the formats we accept. */
export const EXT_FOR: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
};

/**
 * Determine the real content type from the file's magic bytes, or null if the
 * content isn't a genuine image/PDF (this stops a script/HTML file disguised
 * with an image MIME type).
 */
export function sniffType(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return "image/gif";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (buf.toString("ascii", 0, 8).replace(/^[\s﻿]+/, "").startsWith("%PDF-")) return "application/pdf";
  return null;
}

/** Strip anything that could break/inject an HTTP header; keep a safe filename. */
export function safeFilename(name: string | null | undefined): string {
  const cleaned = (name ?? "")
    .replace(/[\r\n"\\]/g, "")
    .replace(/[\x00-\x1f]/g, "")
    .trim();
  return cleaned.slice(0, 200) || "file";
}
