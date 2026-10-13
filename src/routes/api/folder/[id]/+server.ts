import { error, json } from "@sveltejs/kit";
import { managementTokenOf } from "$lib/server/http";
import {
  addFolderFile,
  renameFolder,
  finishFolder,
  deleteFolder,
} from "$lib/server/services/folders";
import type { RequestHandler } from "./$types";

const emptyBody = () =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      controller.close();
    },
  });

export const POST: RequestHandler = async ({ params, request, getClientAddress }) => {
  const encodedName = request.headers.get("X-Content-Name");
  if (!encodedName) {
    error(400);
  }
  let name: string;
  try {
    name = decodeURIComponent(encodedName);
  } catch {
    error(400);
  }
  // SvelteKit passes a null body for an empty request, but folders may hold empty files.
  const body = request.body ?? (request.headers.get("Content-Length") === "0" ? emptyBody() : null);
  if (!body) {
    error(400);
  }

  const result = await addFolderFile(
    params.id,
    managementTokenOf(request),
    {
      name,
      contentType: request.headers.get("Content-Type") || "application/octet-stream",
      body,
    },
    getClientAddress(),
  );
  return json(result, { status: 201 });
};
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
