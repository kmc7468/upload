import { error, json } from "@sveltejs/kit";
import { findFile } from "$lib/server/db/file";
import { ID_REGEX } from "$lib/server/loadenv";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params, request }) => {
  const fileID = params.id;
  if (!ID_REGEX.test(fileID)) {
    error(404);
  }

  const managementToken = request.headers.get("X-Management-Token");
  if (!managementToken) {
    error(400);
  }

  const file = await findFile(fileID);
  return json({
    exists: !!file && file.managementToken === managementToken,
  });
};