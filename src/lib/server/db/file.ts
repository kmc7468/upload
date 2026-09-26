import db from "./kysely";

// Lifecycle and authorization belong to the parent, including single-file uploads.
export const findFile = async (id: string) =>
  db!
    .selectFrom("file")
    .innerJoin("folder", "folder.id", "file.folderId")
    .selectAll("file")
    .select([
      "folder.managementToken",
      "folder.uploadedAt",
      "folder.expireAt",
      "folder.isDisposable",
      "folder.isEncrypted",
      "folder.expectedCount",
    ])
    .where("file.id", "=", id)
    .where("folder.ready", "=", 1)
    .where("folder.expireAt", ">", Date.now())
    .executeTakeFirst();

export const getAllFileIDs = async () => {
  const result = await db!.selectFrom("file").select("id").execute();
  return result.map((row) => row.id);
};
