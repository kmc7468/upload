import fs from "node:fs/promises";
import { FILE_EXPIRY, UPLOAD_DIR } from "$lib/server/loadenv";
import { formatDuration, formatSize } from "$lib/utils";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async () => {
  // Uploads live on a RAM disk, so its size is the server's storage capacity.
  const { bsize, blocks } = await fs.statfs(UPLOAD_DIR);
  return {
    fileExpiry: formatDuration(FILE_EXPIRY),
    storageCapacity: formatSize(bsize * blocks),
  };
};
