import fs from "fs";
import schedule from "node-schedule";
import { UPLOAD_DIR, CACHE_DIR } from "$lib/server/loadenv";

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
} else if (!fs.statSync(UPLOAD_DIR).isDirectory()) {
  // TODO: Error
}

if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
} else if (!fs.statSync(CACHE_DIR).isDirectory()) {
  // TODO: Error
}

schedule.scheduleJob("* * * * *", () => {
  // TODO
});