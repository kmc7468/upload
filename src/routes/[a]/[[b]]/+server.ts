import { error, redirect, type Cookies } from "@sveltejs/kit";
import { rendersInline } from "$lib/server/content-type";
import { findFolder } from "$lib/server/db/folder";
import {
  contentDisposition,
  conversionOf,
  fileResponse,
  managementTokenOf,
  plainTextErrors,
} from "$lib/server/http";
import { convertedName, type FileType } from "$lib/server/images";
import { ID_REGEX } from "$lib/server/loadenv";
import { deleteFile, downloadFile, inspectFile } from "$lib/server/services/files";
import { deleteFolder, downloadFolder } from "$lib/server/services/folders";
import { uploadResponse } from "$lib/server/upload";
import type { RequestHandler } from "./$types";

const NOT_FOUND = "Not found. The file may have expired or been deleted.";

// A name in the URL asks for a download under that name; a bare ID is shown inline
// when the type allows. Either way, a converted image gets the matching extension.
const dispositionOf = (
  file: { name: string; contentType: string },
  urlName?: string,
  requiredType?: FileType,
) => {
  if (!urlName) {
    // Browsers guess a name for inline content they cannot show, so a .docx would
    // otherwise be saved by its ZIP content. An attachment keeps the stored name.
    return contentDisposition(rendersInline(file.contentType) ? "inline" : "attachment", file.name);
  }

  return contentDisposition(
    "attachment",
    requiredType ? convertedName(urlName, requiredType) : urlName,
  );
};

// curl gets tar, which it can extract while streaming; browsers get ZIP. A .tar name
// or ?format= overrides this, and ?zip forces ZIP.
const archiveFormatOf = (request: Request, url: URL, urlName?: string) => {
  const format =
    (url.searchParams.has("zip") ? "zip" : url.searchParams.get("format")) ||
    (urlName?.endsWith(".tar") ? "tar" : undefined) ||
    (/curl\//i.test(request.headers.get("User-Agent") || "") ? "tar" : "zip");
  if (format !== "zip" && format !== "tar") {
    error(400, `Unsupported format "${format}". Use zip or tar.`);
  }
  return format;
};

// The folder page downloads through a hidden frame and polls for this cookie to
// learn whether the download started, without buffering the archive itself.
const notifyFolderDownload = (
  cookies: Cookies,
  url: URL,
  id: string,
  state: "started" | "failed",
) => {
  const token = url.searchParams.get("downloadToken");
  if (token && /^[0-9a-f-]{36}$/i.test(token)) {
    cookies.set(`folder-download-${token}`, state, {
      path: `/app/folder/${id}`,
      httpOnly: false,
      secure: url.protocol === "https:",
      sameSite: "strict",
      maxAge: 60,
    });
  }
};

const folderResponse = async (
  { request, url, cookies, getClientAddress }: Parameters<RequestHandler>[0],
  id: string,
  urlName?: string,
) => {
  try {
    const format = archiveFormatOf(request, url, urlName);
    const archive = await downloadFolder(id, {
      format,
      type: conversionOf(url),
      fileIDs: url.searchParams.getAll("file"),
      signal: request.signal,
      clientAddress: getClientAddress(),
    });
    notifyFolderDownload(cookies, url, id, "started");
    return new Response(archive.body, {
      headers: {
        "Content-Type": format === "zip" ? "application/zip" : "application/x-tar",
        "Content-Disposition": contentDisposition("attachment", archive.filename),
        "Cache-Control": "no-store",
        "X-Accel-Buffering": "no",
        Vary: "User-Agent",
      },
    });
  } catch (cause) {
    notifyFolderDownload(cookies, url, id, "failed");
    throw cause;
  }
};

export const GET: RequestHandler = plainTextErrors(async (event) => {
  const { params, request, url, getClientAddress } = event;
  const fileID = params.a;
  const fileName = params.b;
  if (!ID_REGEX.test(fileID)) {
    error(404, NOT_FOUND);
  }

  if (await findFolder(fileID)) {
    if (request.headers.get("Accept")?.includes("text/html") && !url.search && !fileName) {
      redirect(307, `/app/folder/${fileID}`);
    }
    return folderResponse(event, fileID, fileName);
  }

  const requiredType = conversionOf(url);
  const file = await downloadFile(fileID, requiredType, getClientAddress());

  return fileResponse(file, dispositionOf(file, fileName, requiredType));
});

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
  await deleteFile(fileID, managementToken);

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
  const file = await inspectFile(fileID, requiredType);
  return fileResponse(file, dispositionOf(file, params.b, requiredType));
});
