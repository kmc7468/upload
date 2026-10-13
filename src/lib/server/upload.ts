import { error, text, type RequestEvent } from "@sveltejs/kit";
import { shellQuote } from "$lib/shell";
import { plainTextErrors } from "./http";
import { uploadFile } from "./services/files";

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

    const { fileID, managementToken } = await uploadFile({
      fileName,
      contentType: request.headers.get("Content-Type"),
      contentLength: request.headers.get("Content-Length"),

      isDisposable,
      isEncrypted,

      body: request.body,
      clientAddress: getClientAddress(),
    });
    const downloadURL = `${url.origin}/${fileID}/${encodeURIComponent(fileName)}`;
    // The commands use the short URL; the server names the file, so it need not repeat.
    const fileURL = shellQuote(`${url.origin}/${fileID}`);

    return text(
      isEncrypted
        ? `curl -s ${fileURL} | openssl enc -d -aes-256-cbc -pbkdf2 > ${shellQuote(fileName)}\n`
        : `curl -OJ ${fileURL}\n`,
      {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          Location: downloadURL,
          "X-Management-Token": managementToken,
        },
        status: 201,
      },
    );
  });
