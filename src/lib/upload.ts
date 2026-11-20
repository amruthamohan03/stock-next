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

/**
 * Document formats chat accepts on top of images and PDFs. Office and ZIP
 * files have no distinguishing header of their own (a .docx is a ZIP), so the
 * extension picks the type, but only after the bytes prove the container:
 * ZIP for OOXML, OLE2 for legacy Office, NUL-free for text.
 */
const DOC_TYPES: Record<string, { mime: string; magic: "zip" | "ole" | "text" }> = {
  ".docx": { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", magic: "zip" },
  ".xlsx": { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", magic: "zip" },
  ".pptx": { mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", magic: "zip" },
  ".zip": { mime: "application/zip", magic: "zip" },
  ".doc": { mime: "application/msword", magic: "ole" },
  ".xls": { mime: "application/vnd.ms-excel", magic: "ole" },
  ".ppt": { mime: "application/vnd.ms-powerpoint", magic: "ole" },
  ".txt": { mime: "text/plain", magic: "text" },
  ".csv": { mime: "text/csv", magic: "text" },
};
for (const [ext, { mime }] of Object.entries(DOC_TYPES)) EXT_FOR[mime] = ext;

/** File-picker `accept` for everything `sniffDocumentType` allows. */
export const DOCUMENT_ACCEPT = ["image/*", ".pdf", ...Object.keys(DOC_TYPES)].join(",");

/** Images and PDFs as `sniffType`, plus the office/text formats above. */
export function sniffDocumentType(buf: Buffer, name: string): string | null {
  const own = sniffType(buf);
  if (own) return own;
  const ext = name.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? "";
  const doc = DOC_TYPES[ext];
  if (!doc || buf.length === 0) return null;
  const ok =
    doc.magic === "zip"
      ? buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04
      : doc.magic === "ole"
        ? buf.length >= 8 && buf.readUInt32BE(0) === 0xd0cf11e0 && buf.readUInt32BE(4) === 0xa1b11ae1
        : !buf.includes(0);
  return ok ? doc.mime : null;
}

/** Images and PDFs can be shown in the browser; everything else downloads. */
export const isInlineType = (type: string | null | undefined) =>
  !!type && (type.startsWith("image/") || type === "application/pdf");
