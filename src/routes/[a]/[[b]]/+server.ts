
import { error, text } from "@sveltejs/kit";
import { ID_REGEX } from "$lib/server/loadenv";
import { fileDownloadHandler, fileUploadHandler } from "$lib/server/services/files";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params, url, getClientAddress }) => {
  const fileID = params.a;
  const fileName = params.b;
  if (!ID_REGEX.test(fileID)) {
    error(404);
  }

  const requiredType = (() => {
    if (url.searchParams.has("jpeg") || url.searchParams.has("jpg")) {
      return "jpeg";
    } else if (url.searchParams.has("png")) {
      return "png";
    } else {
      return undefined;
    }
  })();

  const file = await fileDownloadHandler({
    fileID,
    requiredType,

    clientAddress: getClientAddress(),
  });

  return new Response(file.content, {
    headers: {
      "Content-Disposition": fileName
        ? `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`
        : "inline",
      "Content-Type": "", // Let the browser infer it
      "Content-Length": file.contentLength.toString(),
    }
  });
};

const isValidFileAttr = (fileAttr: string) => {
  return fileAttr.split("").every(char => "de".includes(char));
};

export const POST: RequestHandler = async ({ request, params, url, getClientAddress }) => {
  const fileAttr = params.b ? params.a : undefined;
  if (fileAttr && !isValidFileAttr(fileAttr)) {
    error(404);
  }
  const isDisposable = fileAttr?.includes("d") ?? false;
  const isEncrypted = fileAttr?.includes("e") ?? false;

  const fileName = params.b ? params.b : params.a;
  const { fileID, downloadURL } = await fileUploadHandler({
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
    isEncrypted ?
      `curl -s ${url.origin}/${fileID} | openssl enc -d -aes-256-cbc -pbkdf2 > "${fileName}"\n` :
      `curl -O ${downloadURL}\n`,
    {
      headers: {
        "Content-Type": "text/plain",
        "Location": downloadURL,
      },
      status: 201,
    }
  );
};

export const PUT = POST;