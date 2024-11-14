import { error } from "@sveltejs/kit";
import { MAX_FILE_SIZE } from "$lib/constants";
import { downloadFile, uploadFile, type FileType } from "../filesystem";
import logger from "../logger";

interface FileUploadContext {
  fileName: string,
  contentType: string | null,
  contentLength: string | null,

  isDisposable: boolean,
  isEncrypted: boolean,

  url: URL,
  body: ReadableStream<Uint8Array> | null,
  clientAddress: string,
}

export const fileUploadHandler = async (context: FileUploadContext) => {
  const {
    fileName,
    contentType,
    contentLength,
    isDisposable,
    isEncrypted,
  } = context;
  if (!contentLength || !context.body) {
    error(400);
  }

  const parsedContentLength = parseInt(contentLength, 10);
  if (parsedContentLength > MAX_FILE_SIZE) {
    error(413);
  } else if (parsedContentLength === 0) {
    error(400);
  }

  const { fileID, fileHash } = await uploadFile(context.body, {
    name: fileName,
    contentType: contentType || "application/octet-stream",

    isDisposable,
    isEncrypted,
  });

  logger.info(
    `File "${fileName}" uploaded as "${fileID}" with hash "${fileHash}" by "${context.clientAddress}" (${parsedContentLength} bytes)`);

  return {
    fileID,
    downloadURL: `${context.url.origin}/${fileID}/${encodeURIComponent(fileName)}`,
  };
};

interface FileDownloadContext {
  fileID: string,
  requiredType?: FileType,

  clientAddress: string,
}

export const fileDownloadHandler = async (context: FileDownloadContext) => {
  const {
    fileID,
    requiredType,
  } = context;

  const file = await downloadFile(fileID, requiredType);
  if (!file) {
    logger.info(`File "${fileID}" not found for download request from "${context.clientAddress}"`);
    error(404);
  }

  logger.info(`File "${fileID}" downloaded by "${context.clientAddress}"`);

  return file;
};