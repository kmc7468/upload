import { error, text, type RequestEvent } from "@sveltejs/kit";
import { plainTextErrors } from "./http";
import { fileUploadHandler } from "./services/files";

const isValidFileAttr = (fileAttr: string) => {
  return fileAttr.split("").every((char) => "de".includes(char));
};

// Handles curl -T uploads to /<name> and /<options>/<name>. The web uploader uses the
// same requests, so the two cannot drift apart.
export const uploadResponse = (fileName: string, fileAttr?: string) =>
  plainTextErrors(async ({ request, url, getClientAddress }: RequestEvent) => {
    if (fileAttr && !isValidFileAttr(fileAttr)) {
      error(404, `Unknown upload options "${fileAttr}". Use d, e or de.`);
    }
    const isDisposable = fileAttr?.includes("d") ?? false;
    const isEncrypted = fileAttr?.includes("e") ?? false;

    const { fileID, downloadURL, managementToken } = await fileUploadHandler({
      fileName,
      contentType: request.headers.get("Content-Type"),
      contentLength: request.headers.get("Content-Length"),

      isDisposable,
      isEncrypted,

      url,
      body: request.body,
      clientAddress: getClientAddress(),
    });

    return text(
      isEncrypted
        ? `curl -s ${url.origin}/${fileID} | openssl enc -d -aes-256-cbc -pbkdf2 > "${fileName}"\n`
        : `curl -OJ ${downloadURL}\n`,
      {
        headers: {
          "Content-Type": "text/plain",
          Location: downloadURL,
          "X-Management-Token": managementToken,
        },
        status: 201,
      },
    );
  });
