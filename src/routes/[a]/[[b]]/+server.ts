import { findFolder, folderDownloadResponse, deleteFolder } from "$lib/server/folders";
import { error, redirect, text } from "@sveltejs/kit";
import { contentDisposition, fileResponse } from "$lib/server/http";
import { ID_REGEX } from "$lib/server/loadenv";
import {
  fileDownloadHandler,
  fileDeleteHandler,
  fileInspectHandler,
  fileUploadHandler,
} from "$lib/server/services/files";
import type { RequestHandler } from "./$types";

const requiredTypeOf = (url: URL) => {
  if (url.searchParams.has("jpeg") || url.searchParams.has("jpg")) {
    return "jpeg";
  } else if (url.searchParams.has("png")) {
    return "png";
  } else {
    return undefined;
  }
};

// A name in the URL asks for a download; a bare ID is shown inline when the type allows.
const dispositionOf = (storedName: string, urlName?: string) =>
  urlName ? contentDisposition("attachment", urlName) : contentDisposition("inline", storedName);

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

  const file = await fileDownloadHandler({
    fileID,
    requiredType: requiredTypeOf(url),

    clientAddress: getClientAddress(),
  });

  return fileResponse(file, dispositionOf(file.name, fileName));
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

// Probes must never consume a Single Download file or folder.
export const HEAD: RequestHandler = async ({ params, url }) => {
  const fileID = params.a;
  if (!ID_REGEX.test(fileID)) {
    error(404);
  }

  if (await findFolder(fileID)) {
    return new Response(null, { status: 405, headers: { Allow: "GET" } });
  }

  const file = await fileInspectHandler({ fileID, requiredType: requiredTypeOf(url) });
  return fileResponse(file, dispositionOf(file.name, params.b));
};
