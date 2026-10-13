import { error, isHttpError } from "@sveltejs/kit";
import crypto from "node:crypto";
import { createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { MAX_FILE_SIZE } from "$lib/constants";
import { formatSize } from "$lib/utils";
import { CACHE_DIR, UPLOAD_DIR } from "./loadenv";

export const FILE_TOO_LARGE = `The file is too large. The limit is ${formatSize(MAX_FILE_SIZE)}.`;

export const isErrno = (cause: unknown, code: string) =>
  cause instanceof Error && "code" in cause && cause.code === code;

export const storedPath = (fileID: string) => path.join(UPLOAD_DIR, fileID);
export const cachedPath = (fileID: string, extension: string) =>
  path.join(CACHE_DIR, `${fileID}.${extension}`);

export const fileSize = async (filePath: string) => (await fs.stat(filePath)).size;
export const storedSize = (fileID: string) => fileSize(storedPath(fileID));

export const storedIDs = async () => {
  const entries = await fs.readdir(UPLOAD_DIR, { withFileTypes: true });
  return entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
};

export const removeStored = (paths: string[]) =>
  Promise.all(paths.map((file) => fs.rm(file, { force: true }))).then(() => {});

class FileTooLarge extends Error {}

// Streams an upload to disk under a reserved ID, enforcing the size limit as it arrives.
export const writeUpload = async (fileID: string, body: ReadableStream<Uint8Array>) => {
  const filePath = storedPath(fileID);
  const hash = crypto.createHash("sha256");
  let size = 0;
  const meter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      size += chunk.byteLength;
      if (size > MAX_FILE_SIZE) {
        callback(new FileTooLarge());
        return;
      }
      hash.update(chunk);
      callback(null, chunk);
    },
  });

  try {
    await pipeline(
      Readable.fromWeb(body as NodeReadableStream),
      meter,
      createWriteStream(filePath, { mode: 0o600, flags: "wx" }),
    );
  } catch (cause) {
    // An exclusive-open collision must never remove another upload.
    if (!isErrno(cause, "EEXIST")) await fs.rm(filePath, { force: true });
    if (isHttpError(cause)) throw cause;
    if (cause instanceof FileTooLarge) error(413, FILE_TOO_LARGE);
    error(400, "The upload was interrupted.");
  }

  return { hash: hash.digest("hex"), size };
};
