import path from "path";
import { env } from "$env/dynamic/private";

export const DATA_DIR = env.DATA_DIR || "data";
export const UPLOAD_DIR = env.UPLOAD_DIR || "uploads";
export const CACHE_DIR = env.CACHE_DIR || path.join(UPLOAD_DIR, "cache");
export const LOG_DIR = env.LOG_DIR || "logs";

export const ID_CHARS = env.ID_CHARS || "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
export const ID_LENGTH = parseInt(env.ID_LENGTH || "6", 10);
export const ID_REGEX = new RegExp(`^[${ID_CHARS}]{${ID_LENGTH}}$`);

export const FILE_EXPIRY = parseInt(env.FILE_EXPIRY || "3600", 10) * 1000; // Default: 1 hour