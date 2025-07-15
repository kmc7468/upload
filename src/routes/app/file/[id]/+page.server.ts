import { findFile } from "$lib/server/db/file";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params }) => {
  const file = await findFile(params.id);
  if (file) {
    return {
      file: {
        id: file.id,
        name: file.name,
        contentType: file.contentType,
        isEncrypted: !!file.isEncrypted,
      },
    };
  } else {
    return {
      file: null,
    }
  }
};