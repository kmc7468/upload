import { type Handle, type HandleServerError, type ServerInit } from "@sveltejs/kit";
import fs from "fs";
import path from "path";
import schedule from "node-schedule";
import { building } from "$app/environment";
import * as constants from "$lib/constants";
import { openDatabase, migrate as migrateDatabase } from "$lib/server/db/kysely";
import { unlinkExpiredFiles, synchronizeWithDatabase } from "$lib/server/filesystem";
import * as loadenv from "$lib/server/loadenv";
import logger from "$lib/server/logger";
import { uploadResponse } from "$lib/server/upload";

const mkdirIfNotExist = (dirPath: string) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  } else if (!fs.statSync(dirPath).isDirectory()) {
    throw new Error(`"${path.resolve(dirPath)}" is not a directory`);
  }
};

// SvelteKit awaits this before serving the first request.
export const init: ServerInit = async () => {
  if (building) return;

  // 환경 변수 덤프
  logger.verbose(`DATA_DIR=${path.resolve(loadenv.DATA_DIR)}`);
  logger.verbose(`UPLOAD_DIR=${path.resolve(loadenv.UPLOAD_DIR)}`);
  logger.verbose(`CACHE_DIR=${path.resolve(loadenv.CACHE_DIR)}`);
  logger.verbose(`LOG_DIR=${path.resolve(loadenv.LOG_DIR)}`);

  logger.verbose(`ID_CHARS=${loadenv.ID_CHARS}`);
  logger.verbose(`ID_LENGTH=${loadenv.ID_LENGTH}`);

  logger.verbose(`FILE_EXPIRY=${loadenv.FILE_EXPIRY / 1000}`);
  logger.verbose(`MAX_FILE_SIZE=${constants.MAX_FILE_SIZE}`);
  logger.verbose(`MAX_CONVERTIBLE_IMAGE_SIZE=${constants.MAX_CONVERTIBLE_IMAGE_SIZE}`);

  // 디렉터리 생성
  mkdirIfNotExist(loadenv.DATA_DIR);
  mkdirIfNotExist(loadenv.UPLOAD_DIR);
  mkdirIfNotExist(loadenv.CACHE_DIR);
  mkdirIfNotExist(loadenv.LOG_DIR);

  // 데이터베이스 초기화
  openDatabase();
  await migrateDatabase();
  await synchronizeWithDatabase();
  await unlinkExpiredFiles();

  // Clean up temporary archives left by versions that buffered downloads on disk.
  for (const entry of fs.readdirSync(loadenv.CACHE_DIR, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name.startsWith("archive-")) {
      fs.rmSync(path.join(loadenv.CACHE_DIR, entry.name), { recursive: true, force: true });
    }
  }

  // Cron Job 등록
  schedule.scheduleJob("* * * * *", unlinkExpiredFiles);

  logger.info("Initialization completed!");
};

// The /app page shadows the upload route for a file named "app", and pages only
// accept GET and POST. Uploads to that one path are handled before routing.
export const handle: Handle = async ({ event, resolve }) => {
  const { method } = event.request;
  if (event.url.pathname === "/app" && (method === "PUT" || method === "POST")) {
    return uploadResponse("app")(event);
  }

  return resolve(event);
};

export const handleError: HandleServerError = ({ error }) => {
  if (error instanceof Error && error.message.startsWith("Not found: ")) {
    // Not found 오류는 로깅하지 않음
    return;
  }

  logger.error(error);
};
