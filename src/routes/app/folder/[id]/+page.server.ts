import { error } from "@sveltejs/kit";
import { folderInfo } from "$lib/server/services/folders";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params }) => {
  const folder = await folderInfo(params.id);
  if (!folder) {
    error(404, {
      title: "Folder Not Found",
      message: "This folder has expired or is no longer available.",
    });
  }
  return { folder };
};
