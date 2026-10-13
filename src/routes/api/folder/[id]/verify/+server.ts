import { json } from "@sveltejs/kit";
import { managementTokenOf } from "$lib/server/http";
import { verifyFolder } from "$lib/server/services/folders";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params, request }) => {
  const name = await verifyFolder(params.id, managementTokenOf(request));
  return json({ name, exists: name !== undefined });
};
