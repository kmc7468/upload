
import { error, text } from "@sveltejs/kit";
import crypto from "crypto";
import { MAX_FILE_SIZE } from "$lib/server/loadenv";
import type { RequestHandler } from "./$types";
import { saveFile } from "$lib/server/filesystem";

const hash = (buffer: Buffer) => {
  return crypto.createHash("sha256").update(buffer).digest("hex");
};

export const PUT: RequestHandler = async ({ params, request, getClientAddress }) => {
  const { fileName, fileAttr } = params;
  const isDisposable = fileAttr?.includes("d") ?? false;

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

  const file = Buffer.from(await request.arrayBuffer());
  if (file.byteLength !== contentLength) {
    error(400);
  }

  const fileHash = hash(file);
  const { fileID, targetFileName } = await saveFile(file, isDisposable);

  // TODO: Logging

  return text(`https://${host}/${fileID}/${encodeURI(fileName)}\n`);
};