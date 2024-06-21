import { env } from "$env/dynamic/public";

export const ID_CHARS = env.PUBLIC_ID_CHARS ?? "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
export const ID_LENGTH = parseInt(env.PUBLIC_ID_LENGTH ?? "6", 10);