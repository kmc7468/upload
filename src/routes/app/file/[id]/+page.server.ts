import { redirect } from "@sveltejs/kit";
import { findFile } from "$lib/server/db/file";
import { storedSize } from "$lib/server/storage";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params }) => {
  const file = await findFile(params.id);
  if (file && file.expectedCount > 1 && file.isDisposable)
    redirect(307, `/app/folder/${file.folderId}`);
  if (file) {
    return {
      file: {
        id: file.id,
        folderId: file.expectedCount > 1 ? file.folderId : null,
        name: file.name,
        contentType: file.contentType,
        size: await storedSize(file.id),
        expireAt: file.expireAt,
        isEncrypted: !!file.isEncrypted,
      },
    };
  } else {
    return {
      file: null,
    };
  }
};
