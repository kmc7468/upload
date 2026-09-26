import { folderInfo } from "$lib/server/folders";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params }) => ({ folder: await folderInfo(params.id) });
