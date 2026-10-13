import { error } from "@sveltejs/kit";
import {
  contentDisposition,
  conversionOf,
  fileResponse,
  managementTokenOf,
} from "$lib/server/http";
import { ID_REGEX } from "$lib/server/loadenv";
import { deleteFile, downloadFile, inspectFile } from "$lib/server/services/files";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params, url, getClientAddress }) => {
  const fileID = params.id;
  if (!ID_REGEX.test(fileID)) {
    error(404);
  }

  const file = await downloadFile(fileID, conversionOf(url), getClientAddress());

  return fileResponse(file, contentDisposition("attachment", file.name));
};

// Probes must never consume a Single Download file.
export const HEAD: RequestHandler = async ({ params, url }) => {
  const fileID = params.id;
  if (!ID_REGEX.test(fileID)) {
    error(404);
  }

  const file = await inspectFile(fileID, conversionOf(url));
  return fileResponse(file, contentDisposition("attachment", file.name));
};

export const DELETE: RequestHandler = async ({ request, params }) => {
  const fileID = params.id;
  if (!ID_REGEX.test(fileID)) {
    error(404);
  }

  const managementToken = managementTokenOf(request);
  if (!managementToken) {
    error(400);
  }

  await deleteFile(fileID, managementToken);

  return new Response(null, { status: 204 });
};
