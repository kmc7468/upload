import db from "./kysely";
import type { NewFolder, FolderUpdate } from "./schema";

export const findFolder = (id: string) =>
  db()
    .selectFrom("folder")
    .selectAll()
    .where("id", "=", id)
    .where("expireAt", ">", Date.now())
    .executeTakeFirst();

export const folderFiles = (id: string) =>
  db()
    .selectFrom("file")
    .selectAll()
    .where("folderId", "=", id)
    .orderBy("position")
    .orderBy("id")
    .execute();

export const insertFolder = (folder: NewFolder) =>
  db().insertInto("folder").values(folder).execute();

export const updateFolder = (id: string, changes: FolderUpdate) =>
  db().updateTable("folder").set(changes).where("id", "=", id).execute();

export const deleteFolderRecords = (id: string) =>
  db()
    .transaction()
    .execute(async (trx) => {
      await trx.deleteFrom("file").where("folderId", "=", id).execute();
      await trx.deleteFrom("folder").where("id", "=", id).execute();
    });

export const expiredFolderIDs = async () => {
  const folders = await db()
    .selectFrom("folder")
    .select("id")
    .where("expireAt", "<=", Date.now())
    .execute();
  return folders.map((folder) => folder.id);
};
