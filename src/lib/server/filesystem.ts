import { error } from "@sveltejs/kit";
import fs from "fs";
import path from "path";
import { MAX_CONVERTIBLE_IMAGE_SIZE } from "$lib/constants";
import { UPLOAD_DIR, CACHE_DIR, ID_CHARS, ID_LENGTH } from "$lib/server/loadenv";

const fileExtensions = ["", ".d"];

type ImageFormat = ".jpeg" | ".png";
type Format = ImageFormat;

const readAndUnlinkFile = (path: string, unlink: boolean) => {
  const file = fs.readFileSync(path);
  if (unlink) {
    fs.unlinkSync(path);
  }
  return file;
}

const convertImageFormat = (file: Buffer, targetFormat: ImageFormat) => {
  // TODO
  return file;
};

const convertFileFormat = (fileID: string, targetPath: string, isDisposable: boolean, targetFormat: Format) => {
  const cachePath = path.join(CACHE_DIR, fileID + targetFormat);
  if (fs.existsSync(cachePath)) {
    return fs.readFileSync(cachePath);
  }

  const file = readAndUnlinkFile(targetPath, isDisposable);
  const convertedFile = (() => {
    if (targetFormat === ".jpeg" || targetFormat === ".png") {
      if (file.byteLength > MAX_CONVERTIBLE_IMAGE_SIZE) {
        error(413);
      }
      return convertImageFormat(file, targetFormat);
    }
  })() as Buffer;

  if (!isDisposable) {
    fs.writeFileSync(cachePath, convertedFile, { mode: 0o600 });
  }
  return convertedFile;
};

export const readFile = (fileID: string, targetFormat?: Format) => {
  const candidates = fileExtensions.map(ext => path.join(UPLOAD_DIR, fileID + ext));
  const targetPath = candidates.find(fs.existsSync);
  if (targetPath === undefined) {
    error(404);
  }

  const extension = path.extname(targetPath);
  const isDisposable = extension.includes("d");

  if (targetFormat === undefined) {
    return readAndUnlinkFile(targetPath, isDisposable);
  } else {
    return convertFileFormat(fileID, targetPath, isDisposable, targetFormat);
  }
};

const generateRandomID = (length: number) => {
  return Array.from({ length }, () => ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)]).join("");
};

const generateUniqueID = () => {
  while (true) {
    const id = generateRandomID(ID_LENGTH);
    const candidates = fileExtensions.map(ext => path.join(UPLOAD_DIR, id + ext));
    if (!candidates.some(fs.existsSync)) {
      return id;
    }
  }
};

export const saveFile = (file: Buffer, isDisposable: boolean) => {
  const fileID = generateUniqueID();
  const targetFileName = fileID + (isDisposable ? ".d" : "");

  fs.writeFileSync(path.join(UPLOAD_DIR, targetFileName), file, { mode: 0o600 });

  return { fileID, targetFileName };
};