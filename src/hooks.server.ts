import { type HandleServerError } from "@sveltejs/kit";
import fs from "fs";
import path from "path";
import schedule from "node-schedule";
import * as constants from "$lib/constants";
import { unlinkExpiredFiles } from "$lib/server/filesystem";
import * as loadenv from "$lib/server/loadenv";
import logger from "$lib/server/logger";

logger.verbose(`DATA_DIR=${path.resolve(loadenv.DATA_DIR)}`);
logger.verbose(`UPLOAD_DIR=${path.resolve(loadenv.UPLOAD_DIR)}`);
logger.verbose(`CACHE_DIR=${path.resolve(loadenv.CACHE_DIR)}`);
logger.verbose(`LOG_DIR=${path.resolve(loadenv.LOG_DIR)}`);

logger.verbose(`ID_CHARS=${loadenv.ID_CHARS}`);
logger.verbose(`ID_LENGTH=${loadenv.ID_LENGTH}`);

logger.verbose(`FILE_EXPIRY=${loadenv.FILE_EXPIRY / 1000}`);
logger.verbose(`MAX_FILE_SIZE=${constants.MAX_FILE_SIZE}`);
logger.verbose(`MAX_CONVERTIBLE_IMAGE_SIZE=${constants.MAX_CONVERTIBLE_IMAGE_SIZE}`);

const mkdirIfNotExist = (dirPath: string) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  } else if (!fs.statSync(dirPath).isDirectory()) {
    throw new Error(`"${path.resolve(dirPath)}" is not a directory`);
  }
};

mkdirIfNotExist(loadenv.DATA_DIR);
mkdirIfNotExist(loadenv.UPLOAD_DIR);
mkdirIfNotExist(loadenv.CACHE_DIR);
mkdirIfNotExist(loadenv.LOG_DIR);

schedule.scheduleJob("* * * * *", unlinkExpiredFiles);

export const handleError: HandleServerError = ({ error }) => {
  logger.error(error);
};