import SQLite3 from "better-sqlite3";
import { Kysely, SqliteDialect } from "kysely";
import path from "path";
import { DATA_DIR } from "../loadenv";
import type Schema from "./schema";

const dialect = new SqliteDialect({
  database: new SQLite3(path.join(DATA_DIR, "database.sqlite")),
});

export default new Kysely<Schema>({ dialect });