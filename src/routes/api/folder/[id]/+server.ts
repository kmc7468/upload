import { error, json } from "@sveltejs/kit";
import { addFolderFile, renameFolder, finishFolder, deleteFolder } from "$lib/server/folders";
import { managementTokenOf } from "$lib/server/http";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ params, request, getClientAddress }) =>
  json(await addFolderFile(params.id, request, getClientAddress()), { status: 201 });
export const PATCH: RequestHandler = async ({ params, request }) => {
  await finishFolder(params.id, managementTokenOf(request));
  return new Response(null, { status: 204 });
};

export const DELETE: RequestHandler = async ({ params, request }) => {
  await deleteFolder(params.id, managementTokenOf(request));
  return new Response(null, { status: 204 });
};

export const PUT: RequestHandler = async ({ params, request }) => {
  const body = await request.json().catch(() => error(400, "Invalid JSON."));
  return json(await renameFolder(params.id, managementTokenOf(request), body?.name));
};
