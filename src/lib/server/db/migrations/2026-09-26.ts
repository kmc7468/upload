import type { Kysely } from "kysely";

export const up = async (db: Kysely<any>) => {
  await db.schema
    .createTable("folder")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("name", "text")
    .addColumn("managementToken", "text", (c) => c.notNull())
    .addColumn("uploadedAt", "integer", (c) => c.notNull())
    .addColumn("expireAt", "integer", (c) => c.notNull())
    .addColumn("isDisposable", "integer", (c) => c.notNull())
    .addColumn("isEncrypted", "integer", (c) => c.notNull())
    .addColumn("expectedCount", "integer", (c) => c.notNull())
    .addColumn("ready", "integer", (c) => c.notNull())
    .execute();

  await db.schema.dropTable("file").execute();
  await db.schema
    .createTable("file")
    .addColumn("id", "text", (c) => c.primaryKey())
    .addColumn("folderId", "text", (c) => c.notNull().references("folder.id"))
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("contentType", "text", (c) => c.notNull())
    .addColumn("position", "integer", (c) => c.notNull())
    .execute();
};
