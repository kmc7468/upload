import { error } from "@sveltejs/kit";
import crypto from "crypto";
import { createReadStream, createWriteStream, existsSync, ReadStream, WriteStream } from "fs";
import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { promisify } from "util";
import { MAX_CONVERTIBLE_IMAGE_SIZE } from "../constants";
import { createFile, findFile, findExpiredFiles, getAllFileIDs, deleteFile } from "./db/file";
import { UPLOAD_DIR, CACHE_DIR, ID_CHARS, ID_LENGTH, FILE_EXPIRY } from "./loadenv";

type ImageType = "jpeg" | "png";
export type FileType = ImageType;

const imageTypes = ["jpeg", "png"] satisfies ImageType[];
const fileTypes = ([] as FileType[]).concat(imageTypes);

const convertToMIMEType = (type: FileType) => {
  switch (type) {
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
  }
};

interface FileAttributes {
  name: string,
  contentType: string,

  isDisposable: boolean,
  isEncrypted: boolean,
}

const generateRandomID = (length: number) => {
  return Array.from({ length }, () => ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)]).join("");
};

const generateUniqueID = () => {
  while (true) {
    const id = generateRandomID(ID_LENGTH);
    if (!existsSync(path.join(UPLOAD_DIR, id))) { // ID의 고유성을 최대한 보장하기 위해 Synchronous API를 사용
      return id;
    }
  }
};

const convertToWritableStream = (writeStream: WriteStream) => {
  return new WritableStream<Uint8Array>({
    write(chunk) {
      return new Promise((resolve, reject) => {
        writeStream.write(chunk, (error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });
    },
    close() {
      return new Promise((resolve, reject) => {
        writeStream.end((error: any) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });
    },
  });
};

const determineContentType = (type: string) => {
  if (type.startsWith("message/") || type.startsWith("multipart/")) {
    return "application/octet-stream";
  } else {
    return type;
  }
};

const randomBytes = promisify(crypto.randomBytes);

export const uploadFile = async (file: ReadableStream<Uint8Array>, attributes: FileAttributes) => {
  const fileID = generateUniqueID();
  const filePath = path.join(UPLOAD_DIR, fileID);
  const fileHash = crypto.createHash("sha256");
  const now = Date.now();

  try {
    const hashStream = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        fileHash.update(chunk);
        controller.enqueue(chunk);
      }
    });
    const fileStream = createWriteStream(filePath, { mode: 0o600 });

    await file.pipeThrough(hashStream).pipeTo(convertToWritableStream(fileStream));
  } catch {
    await fs.unlink(filePath);
    error(400);
  }

  const managementToken = await randomBytes(32).then(buffer => buffer.toString("hex"));

  await createFile({
    id: fileID,
    uploadedAt: now,
    expireAt: now + FILE_EXPIRY,
    managementToken,

    name: attributes.name,
    contentType: determineContentType(attributes.contentType),

    isDisposable: attributes.isDisposable ? 1 : 0,
    isEncrypted: attributes.isEncrypted ? 1 : 0,
  });

  return { fileID, fileHash: fileHash.digest("hex"), managementToken };
};

const readFileIfExist = async (path: string) => {
  try {
    return await fs.readFile(path);
  } catch (error: any) {
    if (error?.code === "ENOENT") {
      return null;
    } else {
      throw error;
    }
  }
};

const readAndUnlinkFile = async (path: string, unlink: boolean) => {
  const file = await fs.readFile(path);
  if (unlink) {
    await fs.unlink(path);
  }
  return file;
};

const convertImage = (file: Buffer, requiredType: ImageType) => {
  const image = sharp(file, {
    limitInputPixels: false,
  }).keepMetadata();

  switch (requiredType) {
    case "jpeg":
      return image.jpeg({
        quality: 100,
        chromaSubsampling: "4:4:4",
      }).toBuffer();
    case "png":
      return image.png().toBuffer();
  }
};

const readAndConvertFile = async (fileID: string, isDisposable: boolean, requiredType: FileType) => {
  const requiredMIMEType = convertToMIMEType(requiredType);

  const cachePath = path.join(CACHE_DIR, fileID + "." + requiredType);
  const cachedFile = await readFileIfExist(cachePath);
  if (cachedFile !== null) {
    return {
      content: cachedFile,
      contentType: requiredMIMEType,
    };
  }

  const file = await readAndUnlinkFile(path.join(UPLOAD_DIR, fileID), isDisposable);
  const convertedFile = await (() => {
    if (imageTypes.includes(requiredType)) {
      if (file.byteLength > MAX_CONVERTIBLE_IMAGE_SIZE) {
        error(413);
      }
      return convertImage(file, requiredType as ImageType);
    }
  })() as Buffer;

  if (!isDisposable) {
    await fs.writeFile(cachePath, convertedFile, { mode: 0o600 });
  }

  return {
    content: convertedFile,
    contentType: requiredMIMEType,
  };
};

const convertToReadableStream = (readStream: ReadStream) => {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      readStream.on("data", (chunk) => controller.enqueue(new Uint8Array(chunk as Buffer)));
      readStream.on("end", () => controller.close());
      readStream.on("error", (error) => controller.error(error));
    },
    cancel() {
      readStream.destroy();
    },
  });
};

const createReadStreamAndUnlink = (path: string, unlink: boolean) => {
  const stream = createReadStream(path);
  stream.on('end', async () => {
    if (unlink) {
      await fs.unlink(path);
    }
  });
  return convertToReadableStream(stream);
};

export const downloadFile = async (fileID: string, requiredType?: FileType) => {
  const file = await findFile(fileID);
  if (!file) {
    return null;
  }

  const isEncrypted = !!file.isEncrypted;
  if (isEncrypted && requiredType !== undefined) {
    error(400); 
  }

  const isDisposable = !!file.isDisposable;
  if (isDisposable) {
    await deleteFile(fileID);
  }

  if (requiredType === undefined) {
    return {
      name: file.name,
      content: createReadStreamAndUnlink(path.join(UPLOAD_DIR, fileID), isDisposable),
      contentType: file.contentType,
      contentLength: (await fs.stat(path.join(UPLOAD_DIR, fileID))).size,

      isEncrypted,
    };
  } else {
    const convertedFile = await readAndConvertFile(fileID, isDisposable, requiredType);
    return {
      name: file.name,
      content: convertedFile.content,
      contentType: convertedFile.contentType,
      contentLength: convertedFile.content.byteLength,

      isEncrypted,
    }
  }
};

export const deleteAndUnlinkFile = async (fileID: string, managementToken: string) => {
  const file = await findFile(fileID);
  if (!file) {
    error(404);
  } else if (file.managementToken !== managementToken) {
    error(403);
  }

  await Promise.all([
    deleteFile(fileID),
    fs.unlink(path.join(UPLOAD_DIR, fileID)),
  ]);
};

const unlinkIfExist = async (path: string) => {
  try {
    await fs.unlink(path);
  } catch (error: any) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }
};

export const unlinkExpiredFiles = async () => {
  const expiredFiles = await findExpiredFiles();
  await Promise.all(expiredFiles.map(async file => {
    await deleteFile(file.id);
    await Promise.all(fileTypes.map(type => unlinkIfExist(path.join(CACHE_DIR, file.id + "." + type))));
    await fs.unlink(path.join(UPLOAD_DIR, file.id));
  }));
};

const calcDifference = <T>(a: Set<T>, b: Set<T>) => {
  return [...a].filter(value => !b.has(value));
};

export const synchronizeWithDatabase = async () => {
  const entryInFS = await fs.readdir(UPLOAD_DIR);
  const filesInFS = await Promise.all(entryInFS.map(async entry => {
    const stat = await fs.stat(path.join(UPLOAD_DIR, entry));
    return stat.isFile() ? entry : null;
  }));

  const fileIDsInFS = new Set(filesInFS.filter((file): file is string => file !== null));
  const fileIDsInDB = new Set(await getAllFileIDs());

  await Promise.all(calcDifference(fileIDsInFS, fileIDsInDB).map(async fileID => {
    await fs.unlink(path.join(UPLOAD_DIR, fileID));
  }));
  await Promise.all(calcDifference(fileIDsInDB, fileIDsInFS).map(async fileID => {
    await deleteFile(fileID);
  }));
};