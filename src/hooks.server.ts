import fs from "fs";
import path from "path";
import schedule from "node-schedule";
import * as constants from "$lib/constants";
import { unlinkExpiredFiles } from "$lib/server/filesystem";
import * as loadenv from "$lib/server/loadenv";
import logger from "$lib/server/logger";

logger.debug(`UPLOAD_DIR=${path.resolve(loadenv.UPLOAD_DIR)}`);
logger.debug(`CACHE_DIR=${path.resolve(loadenv.CACHE_DIR)}`);
logger.debug(`LOG_DIR=${path.resolve(loadenv.LOG_DIR)}`);

logger.debug(`ID_CHARS=${loadenv.ID_CHARS}`);
logger.debug(`ID_LENGTH=${loadenv.ID_LENGTH}`);

logger.debug(`FILE_EXPIRY=${loadenv.FILE_EXPIRY}`);
logger.debug(`MAX_FILE_SIZE=${constants.MAX_FILE_SIZE}`);
logger.debug(`MAX_CONVERTIBLE_IMAGE_SIZE=${constants.MAX_CONVERTIBLE_IMAGE_SIZE}`);

const mkdirIfNotExist = (dirPath: string) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  } else if (!fs.statSync(dirPath).isDirectory()) {
    throw new Error(`"${path.resolve(dirPath)}" is not a directory`);
  }
};

mkdirIfNotExist(loadenv.UPLOAD_DIR);
mkdirIfNotExist(loadenv.CACHE_DIR);
mkdirIfNotExist(loadenv.LOG_DIR);

schedule.scheduleJob("* * * * *", unlinkExpiredFiles);