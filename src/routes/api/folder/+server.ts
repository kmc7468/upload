import { error, json } from "@sveltejs/kit";
import { createFolder } from "$lib/server/folders";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request, url }) => {
  const body = await request.json().catch(() => error(400, "Invalid upload options."));
  if (!body || typeof body !== "object") error(400, "Invalid upload options.");
  const folder = await createFolder(
    body.count,
    body.isDisposable === true,
    body.isEncrypted === true,
  );
  return json(
    {
      folderID: folder.id,
      managementToken: folder.managementToken,
      downloadURL: `${url.origin}/app/folder/${folder.id}`,
    },
    { status: 201 },
  );
};
