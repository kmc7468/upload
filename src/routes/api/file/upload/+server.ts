import { error, text } from "@sveltejs/kit";
import { fileUploadHandler } from "$lib/server/services/files";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request, url, getClientAddress }) => {
  const fileName = request.headers.get("X-Content-Name");
  if (!fileName) {
    error(400);
  }

  const { fileID, downloadURL } = await fileUploadHandler({
    fileName: decodeURIComponent(fileName),
    contentType: request.headers.get("Content-Type"),
    contentLength: request.headers.get("Content-Length"),

    isDisposable: request.headers.get("X-Content-Disposable") === "true",
    isEncrypted: request.headers.get("X-Content-Encryption") === "true",

    url,
    body: request.body,
    clientAddress: getClientAddress(),
  });

  return text(fileID, {
    headers: {
      "Content-Type": "text/plain",
      "Location": downloadURL,
    },
    status: 201,
  });
};