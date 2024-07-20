import { findFile } from "$lib/server/db/file";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params }) => {
  const fileID = params.id;
  const file = await findFile(fileID);
  if (file) {
    return {
      file: {
        id: params.id,
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