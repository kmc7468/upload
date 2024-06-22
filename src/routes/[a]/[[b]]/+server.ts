
import { error, text } from "@sveltejs/kit";
import crypto from "crypto";
import { MAX_FILE_SIZE } from "$lib/constants";
import { saveFile } from "$lib/server/filesystem";
import type { RequestHandler } from "./$types";

const isValidFileAttr = (fileAttr: string) => {
  return fileAttr.split("").every(
    char => "d".includes(char) &&
    !fileAttr.includes(char, fileAttr.indexOf(char) + 1));
};

const hash = (buffer: Buffer) => {
  return crypto.createHash("sha256").update(buffer).digest("hex");
};

export const PUT: RequestHandler = async ({ request, params, getClientAddress }) => {
  const host = request.headers.get("Host");
  if (!host) {
    error(400);
  }

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
    error(400);
  }

  const file = Buffer.from(await request.arrayBuffer());
  if (file.byteLength !== contentLength) {
    error(400);
  }

  const fileName = params.b ? params.b : params.a;
  const fileHash = hash(file);
  const clientIP = getClientAddress();

  const isDisposable = fileAttr?.includes("d") ?? false;
  const { fileID, targetFileName } = await saveFile(file, isDisposable);

  // TODO: Logging

  return text(`https://${host}/${fileID}/${encodeURI(fileName)}\n`);
};