
import { error, text } from "@sveltejs/kit";
import crypto from "crypto";
import { MAX_FILE_SIZE } from "$lib/constants";
import { readFile, saveFile } from "$lib/server/filesystem";
import { ID_CHARS, ID_LENGTH } from "$lib/server/loadenv";
import type { RequestHandler } from "./$types";

const idRegex = new RegExp(`^[${ID_CHARS}]{${ID_LENGTH}}$`);

export const GET: RequestHandler = async ({ params, url, getClientAddress }) => {
  const fileID = params.a;
  const fileName = params.b;
  if (!idRegex.test(fileID)) {
    error(404);
  }

  const targetFormat = (() => {
    if (url.searchParams.has("jpeg") || url.searchParams.has("jpg")) {
      return ".jpeg";
    } else if (url.searchParams.has("png")) {
      return ".png";
    } else {
      return undefined;
    }
  })();
  const file = await readFile(fileID, targetFormat);

  // TODO: Logging

  return new Response(file.buffer, {
    headers: {
      "Content-Disposition": (fileName ? `attachment; filename="${fileName}"` : "inline")
    }
  });
};

const isValidFileAttr = (fileAttr: string) => {
  return fileAttr.split("").every(
    char => "d".includes(char) &&
    !fileAttr.includes(char, fileAttr.indexOf(char) + 1));
};

const hash = (buffer: Buffer) => {
  return crypto.createHash("sha256").update(buffer).digest("hex");
};

export const PUT: RequestHandler = async ({ request, params, url, getClientAddress }) => {
  const contentLength = (() => {
    const contentLength = request.headers.get("Content-Length");
    if (!contentLength) {
      error(411);
    }
    return parseInt(contentLength, 10);
  })();
  if (contentLength === 0) {
    error(400);
  } else if (contentLength > MAX_FILE_SIZE) {
    error(413);
  }

  const fileAttr = params.b ? params.a : undefined;
  if (fileAttr && !isValidFileAttr(fileAttr)) {
    error(404);
  }

  const file = Buffer.from(await request.arrayBuffer());
  if (file.byteLength !== contentLength) {
    error(400);
  }

  const fileName = params.b ? params.b : params.a;
  const fileHash = hash(file);
  const clientIP = getClientAddress();

  const isDisposable = fileAttr?.includes("d") ?? false;
  const { fileID, targetFileName } = saveFile(file, isDisposable);

  // TODO: Logging

  return text(`${url.origin}/${fileID}/${encodeURI(fileName)}\n`, {
    headers: {
      "Content-Type": "text/plain"
    }
  });
};