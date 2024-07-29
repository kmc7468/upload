import db from "./kysely";
import type { NewFile } from "./schema/file";

export const createFile = async (file: NewFile) => {
  return await db
    .insertInto("file")
    .values(file)
    .executeTakeFirstOrThrow();
};

export const findFile = async (id: string) => {
  return await db
    .selectFrom("file")
    .selectAll()
    .where("id", "=", id)
    .limit(1)
    .executeTakeFirst();
}

export const findExpiredFiles = async () => {
  return await db
    .selectFrom("file")
    .select("id")
    .where("expireAt", "<=", Date.now())
    .execute();
}

export const getAllFileIDs = async () => {
  const result = await db
    .selectFrom("file")
    .select("id")
    .execute();
  return result.map(row => row.id);
}

export const deleteFile = async (id: string) => {
  return await db
    .deleteFrom("file")
    .where("id", "=", id)
    .executeTakeFirstOrThrow();
}