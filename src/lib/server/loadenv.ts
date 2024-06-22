import { env } from "$env/dynamic/private";

export const UPLOAD_DIR = env.UPLOAD_DIR ?? "uploads";

export const ID_CHARS = env.ID_CHARS ?? "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
export const ID_LENGTH = parseInt(env.ID_LENGTH ?? "6", 10);