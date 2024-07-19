import SQLite3 from "better-sqlite3";
import { Kysely, SqliteDialect } from "kysely";
import path from "path";
import { building } from "$app/environment";
import { DATA_DIR } from "../loadenv";
import type Schema from "./schema";

const dialect = !building && new SqliteDialect({
  database: new SQLite3(path.join(DATA_DIR, "database.sqlite")),
});

const db = dialect ? new Kysely<Schema>({ dialect }) : undefined;

export const initializeDatabase = async () => {
  await db!.schema
    .createTable("file")
    .ifNotExists()
    .addColumn("id", "text", cb => cb.primaryKey())
    .addColumn("uploadedAt", "integer", cb => cb.notNull())
    .addColumn("expireAt", "integer", cb => cb.notNull())
    .addColumn("fileName", "text", cb => cb.notNull())
    .addColumn("contentType", "text")
    .addColumn("isDisposable", "integer", cb => cb.notNull())
    .execute();
};

export default db;