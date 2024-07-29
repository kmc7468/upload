import { Kysely } from "kysely";

export async function up(db: Kysely<any>) {
  await db.schema
    .createTable("file")
    .addColumn("id", "text", cb => cb.primaryKey())
    .addColumn("uploadedAt", "integer", cb => cb.notNull())
    .addColumn("expireAt", "integer", cb => cb.notNull())
    .addColumn("name", "text", cb => cb.notNull())
    .addColumn("contentType", "text", cb => cb.notNull())
    .addColumn("isDisposable", "integer", cb => cb.notNull())
    .addColumn("isEncrypted", "integer", cb => cb.notNull())
    .execute();
}

export async function down(db: Kysely<any>) {
  await db.schema.dropTable("file").execute();
}