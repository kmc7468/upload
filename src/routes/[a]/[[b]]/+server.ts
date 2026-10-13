import { findFolder, folderDownloadResponse, deleteFolder } from "$lib/server/folders";
import { error, redirect } from "@sveltejs/kit";
import { convertedName, type FileType } from "$lib/server/filesystem";
import {
  contentDisposition,
  conversionOf,
  fileResponse,
  managementTokenOf,
  plainTextErrors,
} from "$lib/server/http";
import { ID_REGEX } from "$lib/server/loadenv";
import {
  fileDownloadHandler,
  fileDeleteHandler,
  fileInspectHandler,
} from "$lib/server/services/files";
import { uploadResponse } from "$lib/server/upload";
import type { RequestHandler } from "./$types";

const NOT_FOUND = "Not found. The file may have expired or been deleted.";

// A name in the URL asks for a download under that name; a bare ID is shown inline
// when the type allows. Either way, a converted image gets the matching extension.
const dispositionOf = (storedName: string, urlName?: string, requiredType?: FileType) => {
  if (!urlName) {
    return contentDisposition("inline", storedName);
  }

  return contentDisposition(
    "attachment",
    requiredType ? convertedName(urlName, requiredType) : urlName,
  );
};

export const GET: RequestHandler = plainTextErrors(
  async ({ params, request, url, cookies, getClientAddress }) => {
    const fileID = params.a;
    const fileName = params.b;
    if (!ID_REGEX.test(fileID)) {
      error(404, NOT_FOUND);
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

    const requiredType = conversionOf(url);
    const file = await fileDownloadHandler({
      fileID,
      requiredType,

      clientAddress: getClientAddress(),
    });

    return fileResponse(file, dispositionOf(file.name, fileName, requiredType));
  },
);

const upload: RequestHandler = (event) =>
  event.params.b
    ? uploadResponse(event.params.b, event.params.a)(event)
    : uploadResponse(event.params.a)(event);

export const POST = upload;
export const PUT = upload;

export const DELETE: RequestHandler = plainTextErrors(async ({ request, params }) => {
  const fileID = params.a;
  if (!ID_REGEX.test(fileID)) {
    error(404, NOT_FOUND);
  }

  const managementToken = managementTokenOf(request);
  if (!managementToken) {
    error(400, "The X-Management-Token header is required.");
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
});

// Probes must never consume a Single Download file or folder.
export const HEAD: RequestHandler = plainTextErrors(async ({ params, url }) => {
  const fileID = params.a;
  if (!ID_REGEX.test(fileID)) {
    error(404, NOT_FOUND);
  }

  if (await findFolder(fileID)) {
    return new Response(null, { status: 405, headers: { Allow: "GET" } });
  }

  const requiredType = conversionOf(url);
  const file = await fileInspectHandler({ fileID, requiredType });
  return fileResponse(file, dispositionOf(file.name, params.b, requiredType));
});
