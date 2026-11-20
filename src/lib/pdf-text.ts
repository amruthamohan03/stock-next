import { inflateRawSync, inflateSync } from "node:zlib";

/**
 * Server-only: pull positioned text out of a text-based PDF, enough to read a
 * generated document such as a SPARK salary slip. Built on node:zlib alone so
 * the app takes on no PDF dependency.
 *
 * Handles FlateDecode streams, compressed object streams (PDF 1.5+), Type0 /
 * Identity-H fonts through their ToUnicode CMap, simple fonts (WinAnsi or a
 * /Differences table) and the text-positioning operators. It does not
 * rasterise or OCR — a scanned slip has no text to read and is reported so.
 */

export type TextItem = { str: string; x: number; y: number; size: number; page: number };

/** A problem with the file itself — its message is safe to show the uploader. */
export class PdfError extends Error {}

type PdfObject = { dict: string; stream?: Buffer };
type Font = { twoByte: boolean; cmap: Map<number, string> | null; diff: Map<number, string> | null };
type Matrix = [number, number, number, number, number, number];

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];
const mul = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[1] * n[2],
  m[0] * n[1] + m[1] * n[3],
  m[2] * n[0] + m[3] * n[2],
  m[2] * n[1] + m[3] * n[3],
  m[4] * n[0] + m[5] * n[2] + n[4],
  m[4] * n[1] + m[5] * n[3] + n[5],
];

/* ------------------------------------------------------------ objects */

function decodeStream(dict: string, raw: Buffer): Buffer | null {
  const filter = /\/Filter\s*(\[[^\]]*\]|\/\w+)/.exec(dict)?.[1] ?? "";
  if (!filter) return raw;
  if (!/^\/FlateDecode$|^\[\s*\/FlateDecode\s*\]$/.test(filter)) return null; // images etc.
  try {
    return inflateSync(raw);
  } catch {
    try {
      return inflateRawSync(raw.subarray(2));
    } catch {
      return null;
    }
  }
}

function readObjects(buf: Buffer, src: string): Map<number, PdfObject> {
  const objects = new Map<number, PdfObject>();
  const re = /(\d+)\s+\d+\s+obj\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const num = Number(m[1]);
    const start = m.index + m[0].length;
    let end = src.indexOf("endobj", start);
    if (end < 0) break;
    let body = src.slice(start, end);
    const si = body.search(/\bstream\r?\n/);
    let stream: Buffer | undefined;
    if (si >= 0 && !body.slice(0, si).includes("endstream")) {
      const dict = body.slice(0, si);
      const dataStart = start + si + (body[si + 6] === "\r" ? 8 : 7);
      const len = /\/Length\s+(\d+)(?!\s+\d+\s+R)/.exec(dict);
      const dataEnd =
        len && src.slice(dataStart + Number(len[1]), dataStart + Number(len[1]) + 12).includes("endstream")
          ? dataStart + Number(len[1])
          : src.indexOf("endstream", dataStart);
      if (dataEnd < 0) break;
      stream = buf.subarray(dataStart, dataEnd);
      end = src.indexOf("endobj", dataEnd);
      if (end < 0) break;
      body = dict;
    }
    objects.set(num, { dict: body, stream });
    re.lastIndex = end + 6;
  }

  // Objects packed inside compressed object streams.
  for (const o of [...objects.values()]) {
    if (!o.stream || !/\/Type\s*\/ObjStm\b/.test(o.dict)) continue;
    const data = decodeStream(o.dict, o.stream);
    const first = Number(/\/First\s+(\d+)/.exec(o.dict)?.[1]);
    if (!data || !Number.isFinite(first)) continue;
    const text = data.toString("latin1");
    const nums = text.slice(0, first).trim().split(/\s+/).map(Number);
    for (let i = 0; i + 1 < nums.length; i += 2) {
      const from = first + nums[i + 1];
      const to = i + 3 < nums.length ? first + nums[i + 3] : text.length;
      if (!objects.has(nums[i])) objects.set(nums[i], { dict: text.slice(from, to) });
    }
  }
  return objects;
}

/** The raw value text of `/Key` in a dictionary: a ref, a dict, an array or a token. */
function valueOf(dict: string, key: string): string | null {
  const m = new RegExp(`/${key}(?![A-Za-z0-9])\\s*`).exec(dict);
  if (!m) return null;
  let i = m.index + m[0].length;
  const open = dict.startsWith("<<", i) ? "<<" : dict[i] === "[" ? "[" : null;
  if (open) {
    const close = open === "<<" ? ">>" : "]";
    let depth = 0;
    for (let j = i; j < dict.length; j++) {
      if (dict.startsWith(open, j)) {
        depth++;
        j += open.length - 1;
      } else if (dict.startsWith(close, j)) {
        depth--;
        if (depth === 0) return dict.slice(i, j + close.length);
        j += close.length - 1;
      }
    }
    return dict.slice(i);
  }
  const ref = /^(\d+)\s+\d+\s+R/.exec(dict.slice(i));
  if (ref) return ref[0];
  const tok = /^[^\s/<>[\]()]*(?:\/[^\s/<>[\]()]+)?/.exec(dict.slice(i));
  return tok ? tok[0] : null;
}

const refNum = (v: string | null) => {
  const m = v && /^(\d+)\s+\d+\s+R$/.exec(v.trim());
  return m ? Number(m[1]) : null;
};

/** A dictionary value with one level of indirection followed. */
function resolve(objects: Map<number, PdfObject>, v: string | null): string | null {
  const n = refNum(v);
  return n === null ? v : objects.get(n)?.dict ?? null;
}

/* -------------------------------------------------------------- fonts */

const hexToUnicode = (hex: string) => {
  let s = "";
  for (let i = 0; i + 4 <= hex.length; i += 4) s += String.fromCharCode(parseInt(hex.slice(i, i + 4), 16));
  if (hex.length === 2) s = String.fromCharCode(parseInt(hex, 16));
  return s;
};

function parseCMap(text: string): Map<number, string> {
  const map = new Map<number, string>();
  for (const block of text.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const p of block[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]*)>/g))
      map.set(parseInt(p[1], 16), hexToUnicode(p[2]));
  }
  for (const block of text.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const p of block[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(<[0-9a-fA-F]*>|\[[^\]]*\])/g)) {
      const lo = parseInt(p[1], 16);
      const hi = parseInt(p[2], 16);
      if (hi - lo > 0xffff) continue;
      if (p[3].startsWith("[")) {
        const list = [...p[3].matchAll(/<([0-9a-fA-F]*)>/g)].map((x) => hexToUnicode(x[1]));
        list.forEach((u, k) => map.set(lo + k, u));
      } else {
        const base = hexToUnicode(p[3].slice(1, -1));
        const head = base.slice(0, -1);
        const last = base.charCodeAt(base.length - 1);
        for (let c = lo; c <= hi; c++) map.set(c, head + String.fromCharCode(last + c - lo));
      }
    }
  }
  return map;
}

/** Glyph names a /Differences table may use for plain ASCII. */
const GLYPHS: Record<string, string> = {
  space: " ", period: ".", comma: ",", hyphen: "-", minus: "-", colon: ":", semicolon: ";",
  slash: "/", parenleft: "(", parenright: ")", underscore: "_", ampersand: "&", percent: "%",
  zero: "0", one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7",
  eight: "8", nine: "9", quoteright: "'", quotesingle: "'", at: "@", numbersign: "#",
};

function readFont(objects: Map<number, PdfObject>, dict: string): Font {
  const twoByte = /\/Subtype\s*\/Type0\b/.test(dict);
  let cmap: Map<number, string> | null = null;
  const tu = refNum(valueOf(dict, "ToUnicode"));
  const tuObj = tu !== null ? objects.get(tu) : undefined;
  if (tuObj?.stream) {
    const data = decodeStream(tuObj.dict, tuObj.stream);
    if (data) cmap = parseCMap(data.toString("latin1"));
  }
  let diff: Map<number, string> | null = null;
  const enc = resolve(objects, valueOf(dict, "Encoding"));
  const differences = enc && valueOf(enc, "Differences");
  if (differences) {
    diff = new Map();
    let code = 0;
    for (const t of differences.slice(1, -1).match(/\d+|\/[^\s/[\]]+/g) ?? []) {
      if (t[0] !== "/") code = Number(t);
      else {
        const name = t.slice(1);
        const ch = name.length === 1 ? name : GLYPHS[name] ?? /^uni([0-9A-F]{4})$/.exec(name)?.[1];
        if (ch) diff.set(code, ch.length === 4 ? String.fromCharCode(parseInt(ch, 16)) : ch);
        code++;
      }
    }
  }
  return { twoByte, cmap, diff };
}

function decodeText(font: Font | undefined, bytes: string): string {
  if (!font) return bytes;
  const step = font.twoByte ? 2 : 1;
  let out = "";
  for (let i = 0; i + step <= bytes.length; i += step) {
    const code = step === 2 ? (bytes.charCodeAt(i) << 8) | bytes.charCodeAt(i + 1) : bytes.charCodeAt(i);
    const u = font.cmap?.get(code) ?? font.diff?.get(code);
    out += u ?? (step === 1 ? String.fromCharCode(code) : "");
  }
  return out;
}

/* ------------------------------------------------------- content stream */

type Tok =
  | { t: "num"; v: number }
  | { t: "str"; v: string }
  | { t: "name"; v: string }
  | { t: "op"; v: string }
  | { t: "[" | "]" | "<<" | ">>" };

function* lex(s: string): Generator<Tok> {
  const n = s.length;
  let i = 0;
  const ws = (c: string) => c === " " || c === "\n" || c === "\r" || c === "\t" || c === "\f" || c === "\0";
  const delim = (c: string) => ws(c) || "()<>[]{}/%".includes(c);
  while (i < n) {
    const c = s[i];
    if (ws(c)) {
      i++;
    } else if (c === "%") {
      while (i < n && s[i] !== "\n" && s[i] !== "\r") i++;
    } else if (c === "(") {
      let depth = 1;
      let out = "";
      i++;
      while (i < n && depth > 0) {
        const ch = s[i];
        if (ch === "\\") {
          const nx = s[i + 1];
          const esc: Record<string, string> = { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f" };
          if (nx in esc) {
            out += esc[nx];
            i += 2;
          } else if (/[0-7]/.test(nx)) {
            const oct = /^[0-7]{1,3}/.exec(s.slice(i + 1, i + 4))![0];
            out += String.fromCharCode(parseInt(oct, 8) & 0xff);
            i += 1 + oct.length;
          } else if (nx === "\r" || nx === "\n") {
            i += nx === "\r" && s[i + 2] === "\n" ? 3 : 2;
          } else {
            out += nx ?? "";
            i += 2;
          }
          continue;
        }
        if (ch === "(") depth++;
        if (ch === ")" && --depth === 0) break;
        out += ch;
        i++;
      }
      i++;
      yield { t: "str", v: out };
    } else if (c === "<" && s[i + 1] === "<") {
      i += 2;
      yield { t: "<<" };
    } else if (c === ">" && s[i + 1] === ">") {
      i += 2;
      yield { t: ">>" };
    } else if (c === "<") {
      const end = s.indexOf(">", i);
      const hex = s.slice(i + 1, end < 0 ? n : end).replace(/\s+/g, "");
      const padded = hex.length % 2 ? hex + "0" : hex;
      let out = "";
      for (let k = 0; k < padded.length; k += 2) out += String.fromCharCode(parseInt(padded.slice(k, k + 2), 16));
      i = end < 0 ? n : end + 1;
      yield { t: "str", v: out };
    } else if (c === "[" || c === "]") {
      i++;
      yield { t: c };
    } else if (c === "/") {
      let j = i + 1;
      while (j < n && !delim(s[j])) j++;
      yield { t: "name", v: s.slice(i + 1, j) };
      i = j;
    } else {
      let j = i;
      while (j < n && !delim(s[j])) j++;
      if (j === i) {
        i++; // stray delimiter such as "{" — skip
        continue;
      }
      const word = s.slice(i, j);
      i = j;
      if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(word)) {
        yield { t: "num", v: Number(word) };
      } else {
        // Inline image data is binary — jump past it.
        if (word === "ID") {
          const ei = s.slice(i).search(/\sEI(?=\s|$)/);
          i = ei < 0 ? n : i + ei + 3;
        }
        yield { t: "op", v: word };
      }
    }
  }
}

function readPage(content: string, fonts: Map<string, Font>, page: number, items: TextItem[]) {
  let ctm: Matrix = IDENTITY;
  const saved: Matrix[] = [];
  let tm: Matrix = IDENTITY;
  let tlm: Matrix = IDENTITY;
  let leading = 0;
  let font: Font | undefined;
  let fontSize = 0;
  let moved = true;
  let operands: (number | string | (number | string)[])[] = [];
  let array: (number | string)[] | null = null;
  let dictDepth = 0;

  const show = (text: string) => {
    if (!text) return;
    const m = mul(tm, ctm);
    const size = Math.abs(fontSize * (m[3] || m[0])) || fontSize;
    const last = items[items.length - 1];
    if (!moved && last && last.page === page) last.str += text;
    else items.push({ str: text, x: m[4], y: m[5], size, page });
    moved = false;
  };
  const td = (tx: number, ty: number) => {
    tlm = mul([1, 0, 0, 1, tx, ty], tlm);
    tm = tlm;
    moved = true;
  };
  const nums = () => operands.filter((o): o is number => typeof o === "number");

  for (const tok of lex(content)) {
    if (tok.t === "<<") dictDepth++;
    else if (tok.t === ">>") dictDepth = Math.max(0, dictDepth - 1);
    if (dictDepth > 0 || tok.t === ">>") continue;
    if (tok.t === "[") {
      array = [];
      continue;
    }
    if (tok.t === "]") {
      if (array) operands.push(array);
      array = null;
      continue;
    }
    if (tok.t === "num" || tok.t === "str" || tok.t === "name") {
      const v = tok.t === "name" ? `/${tok.v}` : tok.v;
      if (array) array.push(v);
      else operands.push(v);
      continue;
    }
    if (tok.t !== "op") continue;
    const n = nums();
    switch (tok.v) {
      case "q":
        saved.push(ctm);
        break;
      case "Q":
        ctm = saved.pop() ?? IDENTITY;
        break;
      case "cm":
        if (n.length >= 6) ctm = mul(n.slice(-6) as Matrix, ctm);
        break;
      case "BT":
        tm = tlm = IDENTITY;
        moved = true;
        break;
      case "Tf": {
        const name = operands.find((o) => typeof o === "string" && o.startsWith("/")) as string | undefined;
        if (name) font = fonts.get(name.slice(1));
        fontSize = n[n.length - 1] ?? fontSize;
        break;
      }
      case "TL":
        leading = n[0] ?? leading;
        break;
      case "Td":
        if (n.length >= 2) td(n[n.length - 2], n[n.length - 1]);
        break;
      case "TD":
        if (n.length >= 2) {
          leading = -n[n.length - 1];
          td(n[n.length - 2], n[n.length - 1]);
        }
        break;
      case "Tm":
        if (n.length >= 6) {
          tm = tlm = n.slice(-6) as Matrix;
          moved = true;
        }
        break;
      case "T*":
        td(0, -leading);
        break;
      case "Tj":
      case "'":
      case '"': {
        if (tok.v !== "Tj") td(0, -leading);
        const s = operands.findLast((o) => typeof o === "string" && !o.startsWith("/"));
        if (typeof s === "string") show(decodeText(font, s));
        break;
      }
      case "TJ": {
        const arr = operands.findLast((o) => Array.isArray(o));
        if (Array.isArray(arr)) {
          let text = "";
          for (const part of arr) {
            if (typeof part === "number") {
              if (part < -200) text += " "; // a wide kern gap is a word space
            } else if (!part.startsWith("/")) text += decodeText(font, part);
          }
          show(text);
        }
        break;
      }
    }
    operands = [];
  }
}

/**
 * Every text run in the document with its position (PDF units, y upward).
 * Throws an Error with a reader-facing message when the file cannot be read.
 */
export function extractPdfText(buf: Buffer): TextItem[] {
  const src = buf.toString("latin1");
  if (!src.startsWith("%PDF")) throw new PdfError("This is not a PDF file.");
  if (/\/Encrypt\s/.test(src)) throw new PdfError("The PDF is password-protected.");

  const objects = readObjects(buf, src);

  // Pages in document order: walk the page tree, falling back to object order.
  const pageNums: number[] = [];
  const walk = (num: number, depth: number) => {
    const o = objects.get(num);
    if (!o || depth > 20) return;
    if (/\/Type\s*\/Pages\b/.test(o.dict)) {
      const kids = valueOf(o.dict, "Kids") ?? "";
      for (const k of kids.matchAll(/(\d+)\s+\d+\s+R/g)) walk(Number(k[1]), depth + 1);
    } else if (/\/Type\s*\/Page\b/.test(o.dict)) pageNums.push(num);
  };
  const root = /\/Root\s+(\d+)\s+\d+\s+R/.exec(src);
  const pagesRoot = root ? refNum(valueOf(objects.get(Number(root[1]))?.dict ?? "", "Pages")) : null;
  if (pagesRoot !== null) walk(pagesRoot, 0);
  if (pageNums.length === 0)
    for (const [num, o] of objects) if (/\/Type\s*\/Page\b/.test(o.dict)) pageNums.push(num);

  const items: TextItem[] = [];
  pageNums.forEach((num, idx) => {
    let page = objects.get(num)!.dict;
    // Resources may be inherited from an ancestor /Pages node.
    let resources = resolve(objects, valueOf(page, "Resources"));
    for (let hop = 0; !resources && hop < 10; hop++) {
      const parent = refNum(valueOf(page, "Parent"));
      if (parent === null) break;
      page = objects.get(parent)?.dict ?? "";
      resources = resolve(objects, valueOf(page, "Resources"));
    }
    const fonts = new Map<string, Font>();
    const fontDict = resources ? resolve(objects, valueOf(resources, "Font")) : null;
    for (const f of fontDict?.matchAll(/\/([^\s/<>[\]()]+)\s+(\d+)\s+\d+\s+R/g) ?? []) {
      const fd = objects.get(Number(f[2]))?.dict;
      if (fd) fonts.set(f[1], readFont(objects, fd));
    }
    const contents = valueOf(objects.get(num)!.dict, "Contents") ?? "";
    const parts = [...contents.matchAll(/(\d+)\s+\d+\s+R/g)].map((r) => {
      const o = objects.get(Number(r[1]));
      // A /Contents ref may point at an array of refs.
      if (o && !o.stream && o.dict.trim().startsWith("["))
        return [...o.dict.matchAll(/(\d+)\s+\d+\s+R/g)]
          .map((x) => objects.get(Number(x[1])))
          .map((x) => (x?.stream ? decodeStream(x.dict, x.stream)?.toString("latin1") ?? "" : ""))
          .join("\n");
      return o?.stream ? decodeStream(o.dict, o.stream)?.toString("latin1") ?? "" : "";
    });
    readPage(parts.join("\n"), fonts, idx + 1, items);
  });

  if (!items.some((i) => i.str.trim()))
    throw new PdfError("No text found — the PDF looks scanned. Upload the slip downloaded from SPARK.");
  return items;
}

/**
 * Items grouped into visual lines (top to bottom), each sorted left to right.
 * Neighbouring runs on a line are joined with a space only when there is a gap.
 */
export function toLines(items: TextItem[]): TextItem[][] {
  const sorted = [...items].filter((i) => i.str.trim()).sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x);
  const lines: TextItem[][] = [];
  for (const it of sorted) {
    const line = lines[lines.length - 1];
    const tol = Math.max(2, it.size * 0.4);
    if (line && line[0].page === it.page && Math.abs(line[0].y - it.y) <= tol) line.push(it);
    else lines.push([it]);
  }
  return lines.map((l) => l.sort((a, b) => a.x - b.x));
}
