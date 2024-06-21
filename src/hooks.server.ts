import fs from "fs";
import schedule from "node-schedule";
import { UPLOAD_DIR } from "$lib/server/loadenv";

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
} else if (!fs.statSync(UPLOAD_DIR).isDirectory()) {
  // TODO: Error
}

schedule.scheduleJob("* * * * *", () => {
  // TODO
});