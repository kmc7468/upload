import { error } from "@sveltejs/kit";
import { contentDisposition, fileResponse } from "$lib/server/http";
import { ID_REGEX } from "$lib/server/loadenv";
import {
  fileDownloadHandler,
  fileDeleteHandler,
  fileInspectHandler,
} from "$lib/server/services/files";
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
};

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

  return fileResponse(file, contentDisposition("attachment", file.name));
};

// Probes must never consume a Single Download file.
export const HEAD: RequestHandler = async ({ params, url }) => {
  const fileID = params.id;
  if (!ID_REGEX.test(fileID)) {
    error(404);
  }

  const file = await fileInspectHandler({
    fileID,
    requiredType: determineRequiredType(url.searchParams.get("conv")),
  });
  return fileResponse(file, contentDisposition("attachment", file.name));
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
