import { error, isHttpError } from "@sveltejs/kit";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import { Readable } from "node:stream";
import { MAX_FILE_SIZE } from "$lib/constants";
import { readHead, servedContentType } from "../content-type";
import { findFile } from "../db/file";
import { cachedImagePath, convertedName, convertImage, mimeTypeOf, type FileType } from "../images";
import logger from "../logger";
import { FILE_TOO_LARGE, storedPath, storedSize } from "../storage";
import { removeFolder, retainFolder, withFolderLock } from "./lifecycle";
import { storeFile } from "./store";

const NOT_FOUND = "Not found. The file may have expired or been deleted.";

interface FileUpload {
  fileName: string;
  contentType: string | null;
  contentLength: string | null;

  isDisposable: boolean;
  isEncrypted: boolean;

  body: ReadableStream<Uint8Array> | null;
  clientAddress: string;
}

export const uploadFile = async (upload: FileUpload) => {
  const { fileName, contentType, contentLength, isDisposable, isEncrypted } = upload;
  if (!contentLength) {
    error(400, "The Content-Length header is required.");
  }

  // SvelteKit passes a null body only for an empty request.
  const parsedContentLength = parseInt(contentLength, 10);
  if (parsedContentLength > MAX_FILE_SIZE) {
    error(413, FILE_TOO_LARGE);
  } else if (parsedContentLength === 0 || !upload.body) {
    error(400, "Empty files cannot be uploaded.");
  }

  const { fileID, hash, managementToken } = await storeFile(upload.body, {
    name: fileName,
    contentType: contentType || "application/octet-stream",

    isDisposable,
    isEncrypted,
  });

  logger.info(
    `File "${fileName}" uploaded as "${fileID}" with hash "${hash}" by "${upload.clientAddress}" (${parsedContentLength} bytes)`,
  );

  return { fileID, managementToken };
};

type DownloadableFile = NonNullable<Awaited<ReturnType<typeof findFile>>>;

// Looks the file up again under its folder's lock, since a concurrent download or
// deletion of the same folder may have removed it in the meantime.
const withFile = async <T>(fileID: string, action: (file: DownloadableFile) => Promise<T>) => {
  const initial = await findFile(fileID);
  if (!initial) error(404, NOT_FOUND);
  return withFolderLock(initial.folderId, async () => {
    const file = await findFile(fileID);
    if (!file) error(404, NOT_FOUND);
    return action(file);
  });
};

const checkDownloadable = (file: DownloadableFile, requiredType?: FileType) => {
  if (file.isDisposable && file.expectedCount > 1)
    error(403, "Single Download folders must be downloaded together.");
  if (file.isEncrypted && requiredType !== undefined)
    error(400, "Encrypted files cannot be converted.");
};

// Answers HEAD probes without converting the image or consuming a Single Download.
// The size of a converted image is unknown until it is converted, so it is omitted.
export const inspectFile = (fileID: string, requiredType?: FileType) =>
  withFile(fileID, async (file) => {
    checkDownloadable(file, requiredType);

    return {
      name: requiredType ? convertedName(file.name, requiredType) : file.name,
      contentType: requiredType
        ? mimeTypeOf(requiredType)
        : servedContentType(file.contentType, await readHead(storedPath(fileID))),
      contentLength: requiredType ? undefined : await storedSize(fileID),
      isEncrypted: !!file.isEncrypted,
    };
  });

const convertedFile = async (file: DownloadableFile, type: FileType) => {
  // Prepare the result before consuming a disposable folder so conversion
  // failures leave its original available for a retry.
  let content: Buffer;
  try {
    content = file.isDisposable
      ? await convertImage(file.id, type)
      : await fs.readFile(await cachedImagePath(file.id, type));
  } catch (cause) {
    // curl uploads carry no Content-Type, so a non-image is only found out here.
    if (isHttpError(cause)) throw cause;
    error(422, "The file could not be converted. Only images can be converted.");
  }
  if (file.isDisposable) await removeFolder(file.folderId);

  return {
    name: convertedName(file.name, type),
    content,
    contentType: mimeTypeOf(type),
    contentLength: content.byteLength,
    isEncrypted: !!file.isEncrypted,
  };
};

const originalFile = async (file: DownloadableFile) => {
  const filePath = storedPath(file.id);
  const size = await storedSize(file.id);
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
      isEncrypted: !!file.isEncrypted,
    };
  } catch (cause) {
    await release();
    throw cause;
  }
};

export const downloadFile = async (
  fileID: string,
  requiredType: FileType | undefined,
  clientAddress: string,
) => {
  try {
    const file = await withFile(fileID, async (file) => {
      checkDownloadable(file, requiredType);
      return requiredType ? await convertedFile(file, requiredType) : await originalFile(file);
    });
    logger.info(`File "${fileID}" downloaded by "${clientAddress}"`);
    return file;
  } catch (cause) {
    if (isHttpError(cause) && cause.body.message === NOT_FOUND) {
      logger.info(`File "${fileID}" not found for download request from "${clientAddress}"`);
    }
    throw cause;
  }
};

export const deleteFile = (fileID: string, managementToken: string) =>
  withFile(fileID, async (file) => {
    if (file.managementToken !== managementToken) error(403, "Invalid management token.");
    if (file.expectedCount > 1) error(403, "Delete the folder instead.");
    await removeFolder(file.folderId);
  });
