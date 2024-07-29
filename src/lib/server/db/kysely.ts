import SQLite3 from "better-sqlite3";
import { Kysely, SqliteDialect, Migrator } from "kysely";
import path from "path";
import { DATA_DIR } from "../loadenv";
import logger from "../logger";
import type Schema from "./schema";
import migrations from "./migrations";

const dialect = new SqliteDialect({
  database: new SQLite3(path.join(DATA_DIR, "database.sqlite")),
});

const db = new Kysely<Schema>({ dialect });

export async function migrate() {
  logger.info("Database migration started...");

  const migrator = new Migrator({
    db,
    provider: {
      async getMigrations() {
        return migrations;
      }
    }
  });

  const { error, results } = await migrator.migrateToLatest();
  if (error) {
    const failed = results?.find(result => result.status === "Error");
    if (failed) {
      logger.error(`Migration "${failed.migrationName}" failed.`);
    }

    throw error;
  }

  if (results?.length === 0) {
    logger.info("Database is up-to-date.");
  } else {
    logger.info("Database migration completed.");
  }
}

export default db;