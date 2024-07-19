import { error } from "@sveltejs/kit";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { promisify } from "util";
import { MAX_CONVERTIBLE_IMAGE_SIZE } from "../constants";
import { createFile, findFile, findExpiredFiles, getAllFileIDs, deleteFile } from "./db/file";
import { UPLOAD_DIR, CACHE_DIR, ID_CHARS, ID_LENGTH, FILE_EXPIRY } from "./loadenv";

type ImageFormat = ".jpeg" | ".png";
type Format = ImageFormat;

const imageFormats: ImageFormat[] = [".jpeg", ".png"];
const formats = ([] as Format[]).concat(imageFormats);

const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
const existsAsync = promisify(fs.exists);
const unlinkAsync = promisify(fs.unlink);

interface FileAttributes {
  name: string,
  type: string | null,

  isDisposable: boolean,
}

const generateRandomID = (length: number) => {
  return Array.from({ length }, () => ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)]).join("");
};

const generateUniqueID = () => {
  while (true) {
    const id = generateRandomID(ID_LENGTH);
    if (!fs.existsSync(path.join(UPLOAD_DIR, id))) { // ID의 고유성을 최대한 보장하기 위해 Synchronous API를 사용
      return id;
    }
  }
};

const filterContentType = (contentType: string | null) => {
  if (!contentType ||
      contentType === "application/octet-stream" ||
      contentType.startsWith("message/") ||
      contentType.startsWith("multipart/")) {

    return undefined;
  } else {
    return contentType;
  }
}

export const uploadFile = async (file: Buffer, attributes: FileAttributes) => {
  const fileID = generateUniqueID();
  const now = Date.now();

  await writeFileAsync(path.join(UPLOAD_DIR, fileID), file, { mode: 0o600 });
  await createFile({
    id: fileID,
    uploadedAt: now,
    expireAt: now + FILE_EXPIRY,

    fileName: attributes.name,
    contentType: filterContentType(attributes.type),

    isDisposable: attributes.isDisposable ? 1 : 0,
  });

  return fileID;
}

const readFileIfExist = async (path: string) => {
  try {
    return await readFileAsync(path);
  } catch (error: any) {
    if (error?.code === "ENOENT") {
      return null;
    } else {
      throw error;
    }
  }
}

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

const readAndConvertFile = async (fileID: string, isDisposable: boolean, targetFormat: Format) => {
  const cachePath = path.join(CACHE_DIR, fileID + targetFormat);
  const cachedFile = await readFileIfExist(cachePath);
  if (cachedFile !== null) {
    return cachedFile;
  }

  const file = await readAndUnlinkFile(path.join(UPLOAD_DIR, fileID), isDisposable);
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

export const downloadFile = async (fileID: string, targetFormat?: Format) => {
  const file = await findFile(fileID);
  if (!file) {
    error(404);
  }

  const isDisposable = !!file.isDisposable;
  if (isDisposable) {
    await deleteFile(fileID);
  }

  if (targetFormat === undefined) {
    return await readAndUnlinkFile(path.join(UPLOAD_DIR, fileID), isDisposable);
  } else {
    return await readAndConvertFile(fileID, isDisposable, targetFormat);
  }
};

const unlinkIfExist = async (path: string) => {
  if (await existsAsync(path)) {
    await unlinkAsync(path);
  }
};

export const unlinkExpiredFiles = async () => {
  const expiredFiles = await findExpiredFiles();
  await Promise.all(expiredFiles.map(async file => {
    await deleteFile(file.id);
    await Promise.all(formats.map(format => unlinkIfExist(path.join(CACHE_DIR, file.id + format))));
    await unlinkAsync(path.join(UPLOAD_DIR, file.id));
  }));
};

export const synchronizeWithDatabase = async () => {
  const entryInFS = await promisify(fs.readdir)(UPLOAD_DIR);
  const filesInFS = await Promise.all(entryInFS.map(async entry => {
    const stat = await promisify(fs.stat)(path.join(UPLOAD_DIR, entry));
    return stat.isFile() ? entry : null;
  }));

  const fileIdsInFS = new Set(filesInFS.filter(file => file !== null));
  const fileIdsInDB = new Set(await getAllFileIDs());

  await Promise.all([...fileIdsInFS.difference(fileIdsInDB)].map(async fileID => {
    await unlinkAsync(path.join(UPLOAD_DIR, fileID));
  }));
  await Promise.all([...fileIdsInDB.difference(fileIdsInFS)].map(async fileID => {
    await deleteFile(fileID);
  }));
};