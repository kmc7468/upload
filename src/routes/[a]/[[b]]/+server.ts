import { findFolder, folderDownloadResponse, deleteFolder } from "$lib/server/folders";
import { error, redirect, text } from "@sveltejs/kit";
import { ID_REGEX } from "$lib/server/loadenv";
import {
  fileDownloadHandler,
  fileDeleteHandler,
  fileUploadHandler,
} from "$lib/server/services/files";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params, request, url, cookies, getClientAddress }) => {
  const fileID = params.a;
  const fileName = params.b;
  if (!ID_REGEX.test(fileID)) {
    error(404);
  }

  if (await findFolder(fileID)) {
    if (request.headers.get("Accept")?.includes("text/html") && !url.search && !fileName) {
      redirect(307, `/app/folder/${fileID}`);
    }
    if (
      fileName?.endsWith(".tar") &&
      !url.searchParams.has("zip") &&
      !url.searchParams.has("format")
    )
      url.searchParams.set("format", "tar");
    return folderDownloadResponse(fileID, request, url, cookies, getClientAddress);
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

  return new Response(Buffer.isBuffer(file.content) ? new Uint8Array(file.content) : file.content, {
    headers: {
      "Content-Disposition": fileName
        ? `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`
        : "inline",
      "Content-Type": "", // Let the browser infer it
      "Content-Length": file.contentLength.toString(),
    },
  });
};

const isValidFileAttr = (fileAttr: string) => {
  return fileAttr.split("").every((char) => "de".includes(char));
};

export const POST: RequestHandler = async ({ request, params, url, getClientAddress }) => {
  const fileAttr = params.b ? params.a : undefined;
  if (fileAttr && !isValidFileAttr(fileAttr)) {
    error(404);
  }
  const isDisposable = fileAttr?.includes("d") ?? false;
  const isEncrypted = fileAttr?.includes("e") ?? false;

  const fileName = params.b ? params.b : params.a;
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
      : `curl -O ${downloadURL}\n`,
    {
      headers: {
        "Content-Type": "text/plain",
        Location: downloadURL,
        "X-Management-Token": managementToken,
      },
      status: 201,
    },
  );
};

export const PUT = POST;

export const DELETE: RequestHandler = async ({ request, params }) => {
  const fileID = params.a;
  if (!ID_REGEX.test(fileID)) {
    error(404);
  }

  const managementToken = request.headers.get("X-Management-Token") || request.headers.get("Token");
  if (!managementToken) {
    error(400);
  }

  if (await findFolder(fileID)) {
    await deleteFolder(fileID, managementToken);
    return new Response(null, { status: 204 });
  }
  await fileDeleteHandler({
    fileID,
    managementToken,
  });

  return new Response(null, { status: 204 });
};

// Preserve legacy file HEAD behavior, while preventing folder probes from consuming a download.
export const HEAD: RequestHandler = async (event) => {
  if (await findFolder(event.params.a))
    return new Response(null, { status: 405, headers: { Allow: "GET" } });
  return GET(event);
};
