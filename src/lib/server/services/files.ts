import { error } from "@sveltejs/kit";
import { MAX_FILE_SIZE } from "$lib/constants";
import { formatSize } from "$lib/utils";
import {
  downloadFile,
  deleteAndUnlinkFile,
  inspectFile,
  uploadFile,
  type FileType,
} from "../filesystem";
import logger from "../logger";

const NOT_FOUND = "Not found. The file may have expired or been deleted.";

interface FileUploadContext {
  fileName: string;
  contentType: string | null;
  contentLength: string | null;

  isDisposable: boolean;
  isEncrypted: boolean;

  url: URL;
  body: ReadableStream<Uint8Array> | null;
  clientAddress: string;
}

export const fileUploadHandler = async (context: FileUploadContext) => {
  const { fileName, contentType, contentLength, isDisposable, isEncrypted } = context;
  if (!contentLength) {
    error(400, "The Content-Length header is required.");
  }

  // SvelteKit passes a null body only for an empty request.
  const parsedContentLength = parseInt(contentLength, 10);
  if (parsedContentLength > MAX_FILE_SIZE) {
    error(413, `The file is too large. The limit is ${formatSize(MAX_FILE_SIZE)}.`);
  } else if (parsedContentLength === 0 || !context.body) {
    error(400, "Empty files cannot be uploaded.");
  }

  const { fileID, fileHash, managementToken } = await uploadFile(context.body, {
    name: fileName,
    contentType: contentType || "application/octet-stream",

    isDisposable,
    isEncrypted,
  });

  logger.info(
    `File "${fileName}" uploaded as "${fileID}" with hash "${fileHash}" by "${context.clientAddress}" (${parsedContentLength} bytes)`,
  );

  return {
    fileID,
    downloadURL: `${context.url.origin}/${fileID}/${encodeURIComponent(fileName)}`,
    managementToken,
  };
};

interface FileDownloadContext {
  fileID: string;
  requiredType?: FileType;

  clientAddress: string;
}

export const fileDownloadHandler = async (context: FileDownloadContext) => {
  const { fileID, requiredType } = context;

  const file = await downloadFile(fileID, requiredType);
  if (!file) {
    logger.info(`File "${fileID}" not found for download request from "${context.clientAddress}"`);
    error(404, NOT_FOUND);
  }

  logger.info(`File "${fileID}" downloaded by "${context.clientAddress}"`);

  return file;
};

export const fileInspectHandler = async (context: Omit<FileDownloadContext, "clientAddress">) => {
  const file = await inspectFile(context.fileID, context.requiredType);
  if (!file) {
    error(404, NOT_FOUND);
  }

  return file;
};

interface FileDeleteContext {
  fileID: string;
  managementToken: string;
}

export const fileDeleteHandler = async (context: FileDeleteContext) => {
  const { fileID, managementToken } = context;

  await deleteAndUnlinkFile(fileID, managementToken);
};
