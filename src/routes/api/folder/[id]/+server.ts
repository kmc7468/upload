import { error, json } from "@sveltejs/kit";
import {
  addFolderFile,
  renameFolder,
  finishFolder,
  deleteFolder,
  folderDownloadResponse,
} from "$lib/server/folders";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ params, request, getClientAddress }) =>
  json(await addFolderFile(params.id, request, getClientAddress()), { status: 201 });
export const PATCH: RequestHandler = async ({ params, request }) => {
  await finishFolder(params.id, request.headers.get("X-Management-Token"));
  return new Response(null, { status: 204 });
};

export const DELETE: RequestHandler = async ({ params, request }) => {
  await deleteFolder(params.id, request.headers.get("X-Management-Token"));
  return new Response(null, { status: 204 });
};

export const GET: RequestHandler = async ({ params, request, url, cookies, getClientAddress }) =>
  folderDownloadResponse(params.id, request, url, cookies, getClientAddress);

// Probes must never consume a Single Download folder.
export const HEAD: RequestHandler = async () =>
  new Response(null, { status: 405, headers: { Allow: "GET" } });

export const PUT: RequestHandler = async ({ params, request }) => {
  const body = await request.json().catch(() => error(400, "Invalid JSON."));
  return json(await renameFolder(params.id, request.headers.get("X-Management-Token"), body?.name));
};
