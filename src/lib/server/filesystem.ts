import { error } from "@sveltejs/kit";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { promisify } from "util";
import { MAX_CONVERTIBLE_IMAGE_SIZE } from "$lib/constants";
import { findAsync, someAsync } from "$lib/utils";
import { UPLOAD_DIR, CACHE_DIR, ID_CHARS, ID_LENGTH, FILE_EXPIRY } from "$lib/server/loadenv";

type ImageFormat = ".jpeg" | ".png";
type Format = ImageFormat;

const fileExtensions = ["", ".d"];
const imageFormats: ImageFormat[] = [".jpeg", ".png"];
const formats = ([] as Format[]).concat(imageFormats);

const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
const existsAsync = promisify(fs.exists);
const unlinkAsync = promisify(fs.unlink);

const readAndUnlinkFile = async (path: string, unlink: boolean) => {
  const file = await readFileAsync(path);
  if (unlink) {
    await unlinkAsync(path);
  }
  return file;
}

const convertImageFormat = (file: Buffer, targetFormat: ImageFormat) => {
  const image = sharp(file, {
    limitInputPixels: false,
  }).keepMetadata();

  if (targetFormat === ".jpeg") {
    return image.jpeg({
      quality: 100,
      chromaSubsampling: "4:4:4",
    }).toBuffer();
  } else if (targetFormat === ".png") {
    return image.png().toBuffer();
  }
};

const convertFileFormat = async (fileID: string, targetPath: string, isDisposable: boolean, targetFormat: Format) => {
  const cachePath = path.join(CACHE_DIR, fileID + targetFormat);
  if (await existsAsync(cachePath)) {
    return await readFileAsync(cachePath);
  }

  const file = await readAndUnlinkFile(targetPath, isDisposable);
  const convertedFile = await (() => {
    if (imageFormats.includes(targetFormat)) {
      if (file.byteLength > MAX_CONVERTIBLE_IMAGE_SIZE) {
        error(413);
      }
      return convertImageFormat(file, targetFormat);
    }
  })() as Buffer;

  if (!isDisposable) {
    await writeFileAsync(cachePath, convertedFile, { mode: 0o600 });
  }
  return convertedFile;
};

export const readFile = async (fileID: string, targetFormat?: Format) => {
  const candidates = fileExtensions.map(ext => path.join(UPLOAD_DIR, fileID + ext));
  const targetPath = await findAsync(candidates, existsAsync);
  if (targetPath === undefined) {
    error(404);
  }

  const extension = path.extname(targetPath);
  const isDisposable = extension.includes("d");

  return {
    file: targetFormat === undefined ?
      await readAndUnlinkFile(targetPath, isDisposable) :
      await convertFileFormat(fileID, targetPath, isDisposable, targetFormat),
    extension,
  };
};

const generateRandomID = (length: number) => {
  return Array.from({ length }, () => ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)]).join("");
};

const generateUniqueID = async () => {
  while (true) {
    const id = generateRandomID(ID_LENGTH);
    const candidates = fileExtensions.map(ext => path.join(UPLOAD_DIR, id + ext));
    if (!await someAsync(candidates, existsAsync)) {
      return id;
    }
  }
};

export const saveFile = async (file: Buffer, isDisposable: boolean) => {
  const fileID = await generateUniqueID();
  const targetFileName = fileID + (isDisposable ? ".d" : "");

  await writeFileAsync(path.join(UPLOAD_DIR, targetFileName), file, { mode: 0o600 });

  return { fileID, targetFileName };
};

const unlinkIfExist = async (path: string) => {
  if (await existsAsync(path)) {
    await unlinkAsync(path);
  }
};

export const unlinkExpiredFiles = async () => {
  await Promise.all((await promisify(fs.readdir)(UPLOAD_DIR)).map(async file => {
    const filePath = path.join(UPLOAD_DIR, file);
    const fileStat = await promisify(fs.stat)(filePath);
    if (fileStat.isFile() && Date.now() - fileStat.mtimeMs > FILE_EXPIRY) {
      await unlinkAsync(filePath);
      await Promise.all(formats.map(format => unlinkIfExist(path.join(CACHE_DIR, file + format))));
    }
  }));
};