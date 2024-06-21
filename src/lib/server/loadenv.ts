import { env } from "$env/dynamic/private";

export const UPLOAD_DIR = env.UPLOAD_DIR ?? "uploads";

export const MAX_FILE_SIZE = parseInt(env.MAX_FILE_SIZE ?? "1073741824", 10);