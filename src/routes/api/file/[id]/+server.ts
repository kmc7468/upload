import { error } from "@sveltejs/kit";
import { ID_REGEX } from "$lib/server/loadenv";
import { fileDownloadHandler, fileDeleteHandler } from "$lib/server/services/files";
import type { RequestHandler } from "./$types";

const determineRequiredType = (requiredType: string | null) => {
  switch (requiredType) {
    case "jpeg":
    case "png":
      return requiredType;
    case "jpg":
      return "jpeg";
    default:
      return undefined;
  }
}

export const GET: RequestHandler = async ({ params, url, getClientAddress }) => {
  const fileID = params.id;
  if (!ID_REGEX.test(fileID)) {
    error(404);
  }

  const file = await fileDownloadHandler({
    fileID,
    requiredType: determineRequiredType(url.searchParams.get("conv")),

    clientAddress: getClientAddress(),
  });

  return new Response(file.content, {
    headers: {
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "Content-Type": file.contentType,
      "Content-Length": file.contentLength.toString(),
      "X-Content-Encryption": file.isEncrypted.toString(),
    }
  });
};

export const DELETE: RequestHandler = async ({ request, params }) => {
  const fileID = params.id;
  if (!ID_REGEX.test(fileID)) {
    error(404);
  }

  const managementToken = request.headers.get("X-Management-Token");
  if (!managementToken) {
    error(400);
  }

  await fileDeleteHandler({
    fileID,
    managementToken,
  });

  return new Response(null, { status: 204 });
};