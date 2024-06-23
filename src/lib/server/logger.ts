import { createLogger, format, transports } from "winston";
import { LOG_DIR } from "$lib/server/loadenv";

const baseFormat = format.combine(
  format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  format(info => {
    info.level = info.level.toUpperCase();
    return info;
  })(),
  format.errors({ stack: true }),
  format.json(),
);
const formatter = format.printf(({ timestamp, level, message }) => {
  return `${timestamp} ${level}: ${message}`;
});

export default createLogger({
  level: "silly",
  transports: [
    new transports.Console({
      format: format.combine(
        baseFormat, 
        format.colorize({ level: true}),
        formatter),
    }),
    new transports.File({
      filename: (() => {
        const now = new Date();
        const year = now.getFullYear().toString();
        const month = (now.getMonth() + 1).toString().padStart(2, "0");
        const day = now.getDate().toString().padStart(2, "0");
        const hour = now.getHours().toString().padStart(2, "0");
        const minute = now.getMinutes().toString().padStart(2, "0");
        const second = now.getSeconds().toString().padStart(2, "0");

        return `${year}${month}${day}-${hour}${minute}${second}.log`;
      })(),
      dirname: LOG_DIR,
      format: format.combine(baseFormat, formatter),
    }),
  ],
});