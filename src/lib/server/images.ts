import { error } from "@sveltejs/kit";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import sharp from "sharp";
import { MAX_CONVERTIBLE_IMAGE_SIZE } from "$lib/constants";
import { formatSize } from "$lib/utils";
import { cachedPath, isErrno, storedPath } from "./storage";

export type FileType = "jpeg" | "png";
export const FILE_TYPES: FileType[] = ["jpeg", "png"];

export const IMAGE_TOO_LARGE = `The image is too large to convert. The limit is ${formatSize(
  MAX_CONVERTIBLE_IMAGE_SIZE,
)}.`;

export const mimeTypeOf = (type: FileType) => `image/${type}`;

export const convertedName = (name: string, type: FileType) =>
  name.replace(/\.[^.]*$/, "") + (type === "jpeg" ? ".jpg" : ".png");

export const convertImage = async (fileID: string, type: FileType) => {
  const original = storedPath(fileID);
  if ((await fs.stat(original)).size > MAX_CONVERTIBLE_IMAGE_SIZE) error(413, IMAGE_TOO_LARGE);

  const image = sharp(await fs.readFile(original), {
    limitInputPixels: false,
  }).keepMetadata();
  switch (type) {
    case "jpeg":
      return image
        .jpeg({
          quality: 100,
          chromaSubsampling: "4:4:4",
        })
        .toBuffer();
    case "png":
      return image.png().toBuffer();
  }
};

const conversions = new Map<string, Promise<string>>();

// Reuse per-file conversions across individual and batch downloads. Publish only
// complete files, and coalesce concurrent requests for the same image/format.
export const cachedImagePath = async (fileID: string, type: FileType) => {
  const cachePath = cachedPath(fileID, type);
  const pending = conversions.get(cachePath);
  if (pending) return pending;
  const operation = (async () => {
    try {
      await fs.stat(cachePath);
      return cachePath;
    } catch (cause) {
      if (!isErrno(cause, "ENOENT")) throw cause;
    }
    const converted = await convertImage(fileID, type);
    const temporary = `${cachePath}.${crypto.randomUUID()}.tmp`;
    try {
      await fs.writeFile(temporary, converted, { mode: 0o600, flag: "wx" });
      await fs.rename(temporary, cachePath);
    } finally {
      await fs.rm(temporary, { force: true });
    }
    return cachePath;
  })();
  conversions.set(cachePath, operation);
  try {
    return await operation;
  } finally {
    if (conversions.get(cachePath) === operation) conversions.delete(cachePath);
  }
};
