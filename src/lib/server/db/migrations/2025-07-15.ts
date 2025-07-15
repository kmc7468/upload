import { Kysely } from "kysely";

export const up = async (db: Kysely<any>) => {
  await db.schema
    .alterTable("file")
    .addColumn("managementToken", "text", cb => cb.notNull())
    .execute();
}

export const down = async (db: Kysely<any>) => {
  await db.schema
    .alterTable("file")
    .dropColumn("managementToken")
    .execute();
};