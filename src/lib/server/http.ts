import { contentSecurityPolicy } from "./content-type";

export interface ServedFile {
  name: string;
  contentType: string;
  contentLength?: number;
  isEncrypted: boolean;
}

// Browsers read the RFC 5987 filename*, but curl -J only reads filename. The quoted
// fallback carries the UTF-8 bytes as-is, which curl writes back out unchanged.
export const contentDisposition = (type: "inline" | "attachment", filename: string) => {
  // eslint-disable-next-line no-control-regex
  const quoted = Buffer.from(filename.replace(/[\x00-\x1f\x7f"\\]/g, "_"), "utf8").toString(
    "latin1",
  );
  const encoded = encodeURIComponent(filename).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `${type}; filename="${quoted}"; filename*=UTF-8''${encoded}`;
};

// Without content, this answers a HEAD probe with the same headers as the download.
export const fileResponse = (
  file: ServedFile & { content?: Buffer | ReadableStream<Uint8Array> },
  disposition: string,
) => {
  const headers: Record<string, string> = {
    "Content-Type": file.contentType,
    "Content-Disposition": disposition,
    "X-Content-Type-Options": "nosniff",
    "X-Content-Encryption": file.isEncrypted.toString(),
  };
  const policy = contentSecurityPolicy(file.contentType);
  if (policy) {
    headers["Content-Security-Policy"] = policy;
  }
  if (file.contentLength !== undefined) {
    headers["Content-Length"] = file.contentLength.toString();
  }

  const body = Buffer.isBuffer(file.content) ? new Uint8Array(file.content) : file.content;
  return new Response(body ?? null, { headers });
};
