import { json } from "@sveltejs/kit";
import { findFolder, folderFiles, defaultFolderName } from "$lib/server/folders";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params, request }) => {
  const folder = await findFolder(params.id);
  const exists =
    !!folder?.ready && folder.managementToken === request.headers.get("X-Management-Token");
  return json({
    name: exists ? folder!.name || defaultFolderName(await folderFiles(params.id)) : undefined,
    exists,
  });
};
