import { error, json } from "@sveltejs/kit";
import { findFile } from "$lib/server/db/file";
import { managementTokenOf } from "$lib/server/http";
import { ID_REGEX } from "$lib/server/loadenv";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params, request }) => {
  const fileID = params.id;
  if (!ID_REGEX.test(fileID)) {
    error(404);
  }

  const managementToken = managementTokenOf(request);
  if (!managementToken) {
    error(400);
  }

  const file = await findFile(fileID);
  const exists = !!file && file.managementToken === managementToken;
  return json({ exists, expireAt: exists ? file.expireAt : undefined });
};
