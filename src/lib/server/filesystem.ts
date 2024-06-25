import { error } from "@sveltejs/kit";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { MAX_CONVERTIBLE_IMAGE_SIZE } from "$lib/constants";
import { UPLOAD_DIR, CACHE_DIR, ID_CHARS, ID_LENGTH, FILE_EXPIRY } from "$lib/server/loadenv";

type ImageFormat = ".jpeg" | ".png";
type Format = ImageFormat;

const fileExtensions = ["", ".d"];
const imageFormats: ImageFormat[] = [".jpeg", ".png"];
const formats = ([] as Format[]).concat(imageFormats);

const readAndUnlinkFile = (path: string, unlink: boolean) => {
  const file = fs.readFileSync(path);
  if (unlink) {
    fs.unlinkSync(path);
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
  if (fs.existsSync(cachePath)) {
    return fs.readFileSync(cachePath);
  }

  const file = readAndUnlinkFile(targetPath, isDisposable);
  const convertedFile = await (() => {
    if (imageFormats.includes(targetFormat)) {
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

export const readFile = async (fileID: string, targetFormat?: Format) => {
  const candidates = fileExtensions.map(ext => path.join(UPLOAD_DIR, fileID + ext));
  const targetPath = candidates.find(fs.existsSync);
  if (targetPath === undefined) {
    error(404);
  }

  const extension = path.extname(targetPath);
  const isDisposable = extension.includes("d");

  return {
    file: targetFormat === undefined ?
      readAndUnlinkFile(targetPath, isDisposable) :
      await convertFileFormat(fileID, targetPath, isDisposable, targetFormat),
    extension,
  };
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

const unlinkIfExist = (path: string) => {
  if (fs.existsSync(path)) {
    fs.unlinkSync(path);
  }
};

export const unlinkExpiredFiles = () => {
  fs.readdirSync(UPLOAD_DIR).forEach(file => {
    const filePath = path.join(UPLOAD_DIR, file);
    const fileStat = fs.statSync(filePath);
    if (fileStat.isFile() && Date.now() - fileStat.mtimeMs > FILE_EXPIRY) {
      fs.unlinkSync(filePath);
      formats.forEach(format => unlinkIfExist(path.join(CACHE_DIR, file + format)));
    }
  });
};