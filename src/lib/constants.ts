import { env } from "$env/dynamic/public";

export const ONE_KIBI = 1024;
export const ONE_MEBI = 1024 * ONE_KIBI;
export const ONE_GIBI = 1024 * ONE_MEBI;

export const MAX_FILE_SIZE = parseInt(env.PUBLIC_MAX_FILE_SIZE ?? "1073741824", 10);