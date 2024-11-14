import { error, text } from "@sveltejs/kit";
import { MAX_FILE_SIZE } from "$lib/constants";
import { uploadFile } from "$lib/server/filesystem";
import logger from "$lib/server/logger";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request, url, getClientAddress }) => {
  const contentType = request.headers.get("Content-Type") || "application/octet-stream";
  const contentLength = (() => {
    const contentLength = request.headers.get("Content-Length");
    if (!contentLength) {
      error(400);
    }

    const parsedContentLength = parseInt(contentLength, 10);
    if (parsedContentLength > MAX_FILE_SIZE) {
      error(413);
    } else if (parsedContentLength === 0) {
      error(400);
    }
    return parsedContentLength;
  })();

  const fileName = request.headers.get("X-Content-Name");
  const isDisposable = request.headers.get("X-Content-Disposable") === "true";
  const isEncrypted = request.headers.get("X-Content-Encryption") === "true";

  if (!fileName || !request.body) {
    error(400);
  }

  const { fileID, fileHash } = await uploadFile(request.body, {
    name: decodeURIComponent(fileName),
    contentType,

    isDisposable,
    isEncrypted,
  });

  logger.info(
    `File "${fileName}" uploaded as "${fileID}" with hash "${fileHash}" by "${getClientAddress()}" (${contentLength} bytes)`);

  return text(fileID, {
    headers: {
      "Content-Type": "text/plain",
      "Location": `${url.origin}/${fileID}/${encodeURIComponent(fileName)}`,
    },
    status: 201,
  });
};