import fs from "node:fs/promises";

// Uploads are served from the app's own origin, next to the management tokens and
// passphrases in localStorage. Only passive types may render; markup and scripts are
// shown as text, and nosniff stops browsers from reinterpreting either. SVG is the
// exception: it renders, but only inside a sandbox (see SANDBOX_POLICY).
const PASSIVE_TYPE =
  /^(image\/(png|jpeg|gif|webp|avif|bmp|heic|heif)|audio\/[\w.+-]+|video\/[\w.+-]+|application\/pdf)$/;
const TEXT_TYPE = /^(text\/[\w.+-]+|application\/([\w.-]+\+)?(json|xml|javascript|ecmascript))$/;

const SVG_TYPE = "image/svg+xml";
// The document must start with <svg>, so HTML that merely embeds one stays text.
const SVG_START =
  /^\uFEFF?\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE\s+svg[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/i;

// SVG documents can run scripts when opened directly. This blocks scripts and
// external loads, and moves the document to an opaque origin away from localStorage.
const SANDBOX_POLICY = "default-src 'none'; style-src 'unsafe-inline'; sandbox";

const HEAD_SIZE = 512;

const matches = (head: Uint8Array, signature: string | number[], offset = 0) => {
  const bytes =
    typeof signature === "string" ? [...signature].map((char) => char.charCodeAt(0)) : signature;
  return bytes.every((byte, index) => head[offset + index] === byte);
};

const decodeText = (head: Uint8Array) => {
  if (head.includes(0)) return undefined;
  try {
    // Streaming mode tolerates a multibyte character cut off at the end of the head.
    return new TextDecoder("utf-8", { fatal: true }).decode(head, { stream: true });
  } catch {
    return undefined;
  }
};

// curl uploads arrive without a Content-Type, so recognize common passive formats
// by their signature to keep them viewable inline.
const sniff = (head: Uint8Array) => {
  if (matches(head, [0x89, 0x50, 0x4e, 0x47])) return "image/png";
  if (matches(head, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (matches(head, "GIF8")) return "image/gif";
  if (matches(head, "RIFF") && matches(head, "WEBP", 8)) return "image/webp";
  if (matches(head, "RIFF") && matches(head, "WAVE", 8)) return "audio/wav";
  if (matches(head, "%PDF-")) return "application/pdf";
  if (matches(head, "ftyp", 4)) {
    if (["heic", "heix", "mif1", "msf1"].some((brand) => matches(head, brand, 8))) {
      return "image/heic";
    }
    if (matches(head, "avif", 8)) return "image/avif";
    if (matches(head, "qt  ", 8)) return "video/quicktime";
    return "video/mp4";
  }
  if (matches(head, [0x1a, 0x45, 0xdf, 0xa3])) return "video/webm";
  if (matches(head, "OggS")) return "audio/ogg";
  if (matches(head, "fLaC")) return "audio/flac";
  if (matches(head, "ID3")) return "audio/mpeg";
  const text = decodeText(head);
  if (text !== undefined) return SVG_START.test(text) ? SVG_TYPE : "text/plain; charset=utf-8";
  return undefined;
};

export const servedContentType = (storedType: string, head: Uint8Array) => {
  const type = storedType.split(";")[0].trim().toLowerCase();
  if (PASSIVE_TYPE.test(type) || type === SVG_TYPE) {
    return type;
  } else if (TEXT_TYPE.test(type)) {
    const charset = /;\s*charset=([\w.:-]+)/i.exec(storedType)?.[1] ?? "utf-8";
    return `text/plain; charset=${charset}`;
  }

  return sniff(head) ?? "application/octet-stream";
};

export const contentSecurityPolicy = (servedType: string) =>
  servedType === SVG_TYPE ? SANDBOX_POLICY : undefined;

export const readHead = async (filePath: string) => {
  const handle = await fs.open(filePath);
  try {
    const { buffer, bytesRead } = await handle.read(Buffer.alloc(HEAD_SIZE), 0, HEAD_SIZE, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
};
