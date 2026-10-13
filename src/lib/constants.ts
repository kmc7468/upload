import { env } from "$env/dynamic/public";
import { positiveInteger } from "./env";

export const ONE_KIBI = 1024;
export const ONE_MEBI = 1024 * ONE_KIBI;
export const ONE_GIBI = 1024 * ONE_MEBI;

export const MAX_FILE_SIZE = positiveInteger("MAX_FILE_SIZE", env.PUBLIC_MAX_FILE_SIZE, ONE_GIBI);
export const MAX_CONVERTIBLE_IMAGE_SIZE = positiveInteger(
  "MAX_CONVERTIBLE_IMAGE_SIZE",
  env.PUBLIC_MAX_CONVERTIBLE_IMAGE_SIZE,
  30 * ONE_MEBI,
);
