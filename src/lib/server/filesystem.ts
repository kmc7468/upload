import { reserveID, releaseID } from "./ids";
import { error, isHttpError } from "@sveltejs/kit";
import db from "./db/kysely";
import crypto from "crypto";
import { createReadStream, createWriteStream } from "fs";
import fs from "fs/promises";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import path from "path";
import sharp from "sharp";
import { MAX_CONVERTIBLE_IMAGE_SIZE, MAX_FILE_SIZE } from "../constants";
import { formatSize } from "../utils";
import { readHead, servedContentType } from "./content-type";
import { findFile, getAllFileIDs } from "./db/file";
import { UPLOAD_DIR, CACHE_DIR, FILE_EXPIRY } from "./loadenv";

type ImageType = "jpeg" | "png";
export type FileType = ImageType;

const convertToMIMEType = (type: FileType) => {
  switch (type) {
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
  }
};

export const IMAGE_TOO_LARGE = `The image is too large to convert. The limit is ${formatSize(
  MAX_CONVERTIBLE_IMAGE_SIZE,
)}.`;

export const convertedName = (name: string, type: FileType) =>
  name.replace(/\.[^.]*$/, "") + (type === "jpeg" ? ".jpg" : ".png");

type DownloadableFile = NonNullable<Awaited<ReturnType<typeof findFile>>>;

interface FileAttributes {
  folderId?: string;
  position?: number;
  name: string;
  contentType: string;

  isDisposable: boolean;
  isEncrypted: boolean;
}

const determineContentType = (type: string) => {
  if (type.startsWith("message/") || type.startsWith("multipart/")) {
    return "application/octet-stream";
  } else {
    return type;
  }
};

export const uploadFile = async (file: ReadableStream<Uint8Array>, attributes: FileAttributes) => {
  const fileID = await reserveID();
  const filePath = path.join(UPLOAD_DIR, fileID);
  const fileHash = crypto.createHash("sha256");
  let ownFolderID: string | undefined;

  try {
    try {
      let size = 0;
      const hashStream = new Transform({
        transform(chunk, _encoding, callback) {
          size += chunk.byteLength;
          if (size > MAX_FILE_SIZE) {
            callback(Object.assign(new Error("File too large"), { status: 413 }));
            return;
          }
          fileHash.update(chunk);
          callback(null, chunk);
        },
      });
      await pipeline(
        Readable.fromWeb(file as import("node:stream/web").ReadableStream),
        hashStream,
        createWriteStream(filePath, { mode: 0o600, flags: "wx" }),
      );
    } catch (cause) {
      // An exclusive-open collision must never remove another upload.
      if (!(cause && typeof cause === "object" && "code" in cause && cause.code === "EEXIST"))
        await fs.rm(filePath, { force: true });
      if (isHttpError(cause)) throw cause;
      if (cause && typeof cause === "object" && "status" in cause && cause.status === 413)
        error(413, `The file is too large. The limit is ${formatSize(MAX_FILE_SIZE)}.`);
      error(400, "The upload was interrupted.");
    }

    let managementToken: string;
    try {
      if (!attributes.folderId) ownFolderID = await reserveID();
      const folderId = attributes.folderId ?? ownFolderID!;
      managementToken = await db()
        .transaction()
        .execute(async (trx) => {
          if (ownFolderID) {
            const now = Date.now();
            await trx
              .insertInto("folder")
              .values({
                id: ownFolderID,
                name: null,
                managementToken: crypto.randomBytes(32).toString("hex"),
                uploadedAt: now,
                expireAt: now + FILE_EXPIRY,
                isDisposable: +attributes.isDisposable,
                isEncrypted: +attributes.isEncrypted,
                expectedCount: 1,
                ready: 1,
              })
              .execute();
          }
          const folder = await trx
            .selectFrom("folder")
            .selectAll()
            .where("id", "=", folderId)
            .executeTakeFirstOrThrow();
          if (folder.expireAt <= Date.now()) error(410, "The upload has expired.");
          await trx
            .insertInto("file")
            .values({
              id: fileID,
              folderId,
              name: attributes.name,
              contentType: determineContentType(attributes.contentType),
              position: attributes.position ?? 0,
            })
            .execute();
          return folder.managementToken;
        });
    } catch (cause) {
      await fs.rm(filePath, { force: true });
      throw cause;
    }

    return { fileID, fileHash: fileHash.digest("hex"), managementToken };
  } finally {
    releaseID(fileID);
    if (ownFolderID) releaseID(ownFolderID);
  }
};

const convertImage = (file: Buffer, requiredType: ImageType) => {
  const image = sharp(file, {
    limitInputPixels: false,
  }).keepMetadata();

  switch (requiredType) {
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
  const cachePath = path.join(CACHE_DIR, `${fileID}.${type}`);
  const pending = conversions.get(cachePath);
  if (pending) return pending;
  const operation = (async () => {
    try {
      await fs.stat(cachePath);
      return cachePath;
    } catch (cause) {
      if (!(cause && typeof cause === "object" && "code" in cause && cause.code === "ENOENT"))
        throw cause;
    }
    const original = path.join(UPLOAD_DIR, fileID);
    if ((await fs.stat(original)).size > MAX_CONVERTIBLE_IMAGE_SIZE) error(413, IMAGE_TOO_LARGE);
    const converted = await convertImage(await fs.readFile(original), type);
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

const checkDownloadable = (file: DownloadableFile, requiredType?: FileType) => {
  if (file.isDisposable && file.expectedCount > 1)
    error(403, "Single Download folders must be downloaded together.");
  if (file.isEncrypted && requiredType !== undefined)
    error(400, "Encrypted files cannot be converted.");
};

// Answers HEAD probes without converting the image or consuming a Single Download.
// The size of a converted image is unknown until it is converted, so it is omitted.
export const inspectFile = async (fileID: string, requiredType?: FileType) => {
  const initial = await findFile(fileID);
  if (!initial) return null;
  const { withFolderLock } = await import("./folders");
  return withFolderLock(initial.folderId, async () => {
    const file = await findFile(fileID);
    if (!file) return null;
    checkDownloadable(file, requiredType);

    const filePath = path.join(UPLOAD_DIR, fileID);
    return {
      name: requiredType ? convertedName(file.name, requiredType) : file.name,
      contentType: requiredType
        ? convertToMIMEType(requiredType)
        : servedContentType(file.contentType, await readHead(filePath)),
      contentLength: requiredType ? undefined : (await fs.stat(filePath)).size,
      isEncrypted: !!file.isEncrypted,
    };
  });
};

export const downloadFile = async (fileID: string, requiredType?: FileType) => {
  const initial = await findFile(fileID);
  if (!initial) return null;
  const { withFolderLock, retainFolder, removeFolder } = await import("./folders");
  return withFolderLock(initial.folderId, async () => {
    const file = await findFile(fileID);
    if (!file) return null;
    checkDownloadable(file, requiredType);
    const isEncrypted = !!file.isEncrypted;

    if (requiredType !== undefined) {
      // Prepare the result before consuming a disposable folder so conversion
      // failures leave its original available for a retry.
      let content: Buffer;
      try {
        if (file.isDisposable) {
          const original = await fs.readFile(path.join(UPLOAD_DIR, fileID));
          if (original.byteLength > MAX_CONVERTIBLE_IMAGE_SIZE) error(413, IMAGE_TOO_LARGE);
          content = await convertImage(original, requiredType);
        } else {
          content = await fs.readFile(await cachedImagePath(fileID, requiredType));
        }
      } catch (cause) {
        // curl uploads carry no Content-Type, so a non-image is only found out here.
        if (isHttpError(cause)) throw cause;
        error(422, "The file could not be converted. Only images can be converted.");
      }
      if (file.isDisposable) await removeFolder(file.folderId);
      return {
        name: convertedName(file.name, requiredType),
        content,
        contentType: convertToMIMEType(requiredType),
        contentLength: content.byteLength,
        isEncrypted,
      };
    }

    const filePath = path.join(UPLOAD_DIR, fileID);
    const size = (await fs.stat(filePath)).size;
    const contentType = servedContentType(file.contentType, await readHead(filePath));
    const release = retainFolder(file.folderId);
    try {
      if (file.isDisposable) await removeFolder(file.folderId);
      const stream = createReadStream(filePath);
      stream.once("close", () => {
        void release();
      });
      return {
        name: file.name,
        content: Readable.toWeb(stream) as ReadableStream<Uint8Array>,
        contentType,
        contentLength: size,
        isEncrypted,
      };
    } catch (cause) {
      await release();
      throw cause;
    }
  });
};

export const deleteAndUnlinkFile = async (fileID: string, managementToken: string) => {
  const initial = await findFile(fileID);
  if (!initial) error(404, "Not found. The file may have expired or been deleted.");
  const { withFolderLock, removeFolder } = await import("./folders");
  await withFolderLock(initial.folderId, async () => {
    const file = await findFile(fileID);
    if (!file) error(404, "Not found. The file may have expired or been deleted.");
    if (file.managementToken !== managementToken) error(403, "Invalid management token.");
    if (file.expectedCount > 1) error(403, "Delete the folder instead.");
    await removeFolder(file.folderId);
  });
};

export const unlinkExpiredFiles = async () => {
  const { expireFolders } = await import("./folders");
  await expireFolders();
};

const calcDifference = <T>(a: Set<T>, b: Set<T>) => {
  return [...a].filter((value) => !b.has(value));
};

export const synchronizeWithDatabase = async () => {
  const entryInFS = await fs.readdir(UPLOAD_DIR);
  const filesInFS = await Promise.all(
    entryInFS.map(async (entry) => {
      const stat = await fs.stat(path.join(UPLOAD_DIR, entry));
      return stat.isFile() ? entry : null;
    }),
  );

  const fileIDsInFS = new Set(filesInFS.filter((file): file is string => file !== null));
  const fileIDsInDB = new Set(await getAllFileIDs());

  await Promise.all(
    calcDifference(fileIDsInFS, fileIDsInDB).map(async (fileID) => {
      await fs.unlink(path.join(UPLOAD_DIR, fileID));
    }),
  );
  await Promise.all(
    calcDifference(fileIDsInDB, fileIDsInFS).map(async (fileID) => {
      const file = await db()
        .selectFrom("file")
        .selectAll()
        .where("id", "=", fileID)
        .executeTakeFirst();
      if (file?.folderId) {
        const { discardFolder } = await import("./folders");
        await discardFolder(file.folderId);
      }
    }),
  );
};
