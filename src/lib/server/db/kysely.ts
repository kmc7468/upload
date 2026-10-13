import SQLite3 from "better-sqlite3";
import { Kysely, SqliteDialect } from "kysely";
import { Migrator } from "kysely/migration";
import path from "path";
import { DATA_DIR } from "../loadenv";
import logger from "../logger";
import type Schema from "./schema";
import migrations from "./migrations";

let instance: Kysely<Schema> | undefined;

// Opened by the init hook once the data directory exists, never at import time.
export const openDatabase = () => {
  instance ??= new Kysely<Schema>({
    dialect: new SqliteDialect({
      database: new SQLite3(path.join(DATA_DIR, "database.sqlite")),
    }),
  });
};

const db = () => {
  if (!instance) {
    throw new Error("Database is not initialized");
  }

  return instance;
};

export const migrate = async () => {
  logger.info("Database migration started...");

  const migrator = new Migrator({
    db: db(),
    provider: {
      getMigrations: async () => {
        return migrations;
      },
    },
  });

  const { error, results } = await migrator.migrateToLatest();
  if (error) {
    const failed = results?.find((result) => result.status === "Error");
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
};

export default db;
