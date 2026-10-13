import { error, isHttpError, text, type RequestEvent } from "@sveltejs/kit";
import { STATUS_CODES } from "node:http";
import { contentSecurityPolicy } from "./content-type";
import type { FileType } from "./filesystem";

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

// Accepts both ?conv=jpg and the shorter ?jpg, ?jpeg and ?png.
export const conversionOf = (url: URL): FileType | undefined => {
  const value =
    url.searchParams.get("conv") ||
    ["jpg", "jpeg", "png"].find((type) => url.searchParams.has(type));
  switch (value) {
    case undefined:
    case "":
      return undefined;
    case "jpg":
    case "jpeg":
      return "jpeg";
    case "png":
      return "png";
    default:
      error(400, `Unsupported conversion "${value}". Use jpg or png.`);
  }
};

export const managementTokenOf = (request: Request) =>
  request.headers.get("X-Management-Token") || request.headers.get("Token");

// SvelteKit answers non-browser clients with JSON errors. curl users read the body
// directly, so they get a single line of text instead; browsers keep the error page.
export const plainTextErrors =
  <Event extends RequestEvent>(handler: (event: Event) => Promise<Response>) =>
  async (event: Event) => {
    try {
      return await handler(event);
    } catch (cause) {
      if (!isHttpError(cause) || event.request.headers.get("Accept")?.includes("text/html")) {
        throw cause;
      }

      const message = /^Error: \d+$/.test(cause.body.message)
        ? `${cause.status} ${STATUS_CODES[cause.status]}`
        : cause.body.message;
      return text(`${message}\n`, {
        status: cause.status,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
  };
