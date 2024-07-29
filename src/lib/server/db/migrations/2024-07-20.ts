import { Kysely } from "kysely";

export const up = async (db: Kysely<any>) => {
  await db.schema
    .createTable("file")
    .ifNotExists() // For compatibility
    .addColumn("id", "text", cb => cb.primaryKey())
    .addColumn("uploadedAt", "integer", cb => cb.notNull())
    .addColumn("expireAt", "integer", cb => cb.notNull())
    .addColumn("name", "text", cb => cb.notNull())
    .addColumn("contentType", "text", cb => cb.notNull())
    .addColumn("isDisposable", "integer", cb => cb.notNull())
    .addColumn("isEncrypted", "integer", cb => cb.notNull())
    .execute();
};

export const down = async (db: Kysely<any>) => {
  await db.schema.dropTable("file").execute();
};