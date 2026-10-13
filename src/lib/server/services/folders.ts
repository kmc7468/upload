import { error, isHttpError } from "@sveltejs/kit";
import path from "node:path";
import { Readable } from "node:stream";
import { MAX_CONVERTIBLE_IMAGE_SIZE } from "$lib/constants";
import { archiveName } from "$lib/archive-name";
import { zip, tar, type ArchiveEntry } from "../archive";
import { findFolder, folderFiles, insertFolder, updateFolder } from "../db/folder";
import { reserveID, releaseID } from "../ids";
import { cachedImagePath, convertedName, IMAGE_TOO_LARGE, type FileType } from "../images";
import { FILE_EXPIRY } from "../loadenv";
import logger from "../logger";
import { cachedPath, fileSize, removeStored, storedPath, storedSize } from "../storage";
import { removeFolder, retainFolder, withFolderLock } from "./lifecycle";
import { managementToken, storeFile } from "./store";

const NOT_FOUND = "Not found. The folder may have expired or been deleted.";

export async function createFolder(count: number, disposable: boolean, encrypted: boolean) {
  if (!Number.isInteger(count) || count < 2 || count > 1000) {
    error(400, "Choose between 2 and 1000 files.");
  }
  const id = await reserveID();
  try {
    const now = Date.now();
    const folder = {
      id,
      managementToken: managementToken(),
      uploadedAt: now,
      expireAt: now + FILE_EXPIRY,
      isDisposable: +disposable,
      isEncrypted: +encrypted,
      expectedCount: count,
      ready: 0,
      name: null,
    };
    await insertFolder(folder);
    return folder;
  } finally {
    releaseID(id);
  }
}

async function managedFolder(id: string, token: string | null) {
  const folder = await findFolder(id);
  if (!folder) {
    error(404, NOT_FOUND);
  }
  if (!token || token !== folder.managementToken) {
    error(403, "Invalid management token.");
  }
  return folder;
}

interface FolderFileUpload {
  name: string;
  contentType: string;
  body: ReadableStream<Uint8Array>;
}

export async function addFolderFile(
  id: string,
  token: string | null,
  upload: FolderFileUpload,
  clientAddress: string,
) {
  return withFolderLock(id, async () => {
    const folder = await managedFolder(id, token);
    const members = await folderFiles(id);
    if (folder.ready || members.length >= folder.expectedCount) {
      error(409);
    }
    if (!upload.name || Buffer.byteLength(upload.name) > 4096) {
      error(400);
    }
    const result = await storeFile(upload.body, {
      name: upload.name,
      contentType: upload.contentType,
      isDisposable: !!folder.isDisposable,
      isEncrypted: !!folder.isEncrypted,
      folderId: id,
      position: members.length,
    });
    logger.info(
      `File ${JSON.stringify(upload.name)} uploaded as "${result.fileID}" in folder "${id}" with hash "${result.hash}" by "${clientAddress}" (${result.size} bytes)`,
    );
    return { fileID: result.fileID };
  });
}

export async function finishFolder(id: string, token: string | null) {
  return withFolderLock(id, async () => {
    const folder = await managedFolder(id, token);
    if ((await folderFiles(id)).length !== folder.expectedCount) {
      error(409, "The upload is incomplete.");
    }
    await updateFolder(id, { ready: 1 });
  });
}

export async function renameFolder(id: string, token: string | null, name: unknown) {
  return withFolderLock(id, async () => {
    const folder = await managedFolder(id, token);
    if (!folder.ready) {
      error(409, "The upload is incomplete.");
    }
    if (typeof name !== "string" || !name.trim() || name.trim().length > 200) {
      error(400, "Folder name must contain between 1 and 200 characters.");
    }
    // eslint-disable-next-line no-control-regex
    if (/[\x00-\x1f\x7f]/.test(name)) {
      error(400, "Folder name contains invalid characters.");
    }
    const normalized = name.trim();
    await updateFolder(id, { name: normalized });
    return { name: normalized };
  });
}

export async function deleteFolder(id: string, token: string | null) {
  return withFolderLock(id, async () => {
    await managedFolder(id, token);
    await removeFolder(id);
  });
}

export function defaultFolderName(files: { name: string }[]) {
  return files.length ? `${files[0].name} + ${files.length - 1} more` : "Folder";
}

export async function folderInfo(id: string) {
  const folder = await findFolder(id);
  if (!folder?.ready) return null;
  const files = await folderFiles(id);
  return {
    id,
    name: folder.name || defaultFolderName(files),
    isDisposable: !!folder.isDisposable,
    isEncrypted: !!folder.isEncrypted,
    uploadedAt: folder.uploadedAt,
    expireAt: folder.expireAt,
    files: await Promise.all(
      files.map(async (file) => ({
        id: file.id,
        name: file.name,
        contentType: file.contentType,
        size: await storedSize(file.id),
      })),
    ),
  };
}

// Returns the folder's name and expiry for its owner, or undefined for anyone else.
export async function verifyFolder(id: string, token: string | null) {
  const folder = await findFolder(id);
  if (!folder?.ready || folder.managementToken !== token) return undefined;
  return {
    name: folder.name || defaultFolderName(await folderFiles(id)),
    expireAt: folder.expireAt,
  };
}

function safeName(name: string, used: Set<string>) {
  const base =
    name
      .split(/[\\/]/)
      .pop()!
      // Archive paths must not contain control characters.
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x1f\x7f]/g, "_")
      .replace(/[<>:"|?*]/g, "_")
      .replace(/[. ]+$/, "")
      .slice(0, 180) || "file";
  let result = base;
  let suffix = 1;
  while (used.has(result.toLowerCase())) {
    const ext = path.extname(base);
    result = `${base.slice(0, base.length - ext.length)} (${suffix++})${ext}`;
  }
  used.add(result.toLowerCase());
  return result;
}

export interface FolderDownload {
  format: "zip" | "tar";
  type?: FileType;
  // Empty for the whole folder.
  fileIDs: string[];
  signal: AbortSignal;
  clientAddress: string;
}

export async function downloadFolder(id: string, options: FolderDownload) {
  const { format, type, fileIDs: requested, signal } = options;
  return withFolderLock(id, async () => {
    const folder = await findFolder(id);
    if (!folder?.ready) {
      error(404, NOT_FOUND);
    }
    const files = await folderFiles(id);
    if (
      requested.length &&
      (folder.isDisposable ||
        new Set(requested).size !== requested.length ||
        requested.some((id) => !files.some((f) => f.id === id)))
    ) {
      error(400, "Invalid selection. Single Download requires the entire folder.");
    }
    const selected = requested.length ? files.filter((f) => requested.includes(f.id)) : files;
    if (
      type &&
      (folder.isEncrypted || selected.some((file) => !file.contentType.startsWith("image/")))
    ) {
      error(
        400,
        folder.isEncrypted
          ? "Encrypted files cannot be converted."
          : "Only images can be converted.",
      );
    }
    const used = new Set<string>();
    const originals: ArchiveEntry[] = [];
    for (const file of selected) {
      const size = await storedSize(file.id);
      if (type && size > MAX_CONVERTIBLE_IMAGE_SIZE) error(413, IMAGE_TOO_LARGE);
      const name = type ? convertedName(file.name, type) : file.name;
      originals.push({
        name: safeName(name, used),
        path: storedPath(file.id),
        size,
        uploadedAt: folder.uploadedAt,
      });
    }
    async function convertedEntry(index: number): Promise<ArchiveEntry> {
      if (!type) return originals[index];
      const converted = await cachedImagePath(selected[index].id, type);
      return { ...originals[index], path: converted, size: await fileSize(converted) };
    }
    // Validate all conversions before consuming a Single Download. Ordinary
    // folders convert lazily, sending each file as soon as it is ready.
    let prepared: ArchiveEntry[] | undefined;
    if (folder.isDisposable && type) {
      prepared = [];
      try {
        for (let index = 0; index < selected.length; index++) {
          prepared.push(await convertedEntry(index));
        }
      } catch (cause) {
        await removeStored(selected.map((file) => cachedPath(file.id, type)));
        if (isHttpError(cause)) throw cause;
        error(422, "An image could not be converted.");
      }
    }
    async function* entries() {
      for (let index = 0; index < selected.length; index++) {
        yield prepared?.[index] ?? (await convertedEntry(index));
      }
    }
    const release = retainFolder(id);
    try {
      // Claim the whole folder atomically before streaming. Bytes remain available
      // to this reader until completion, failure or cancellation.
      if (folder.isDisposable) await removeFolder(id);
      const stream = Readable.from(format === "zip" ? zip(entries()) : tar(entries()), {
        objectMode: false,
        highWaterMark: 64 * 1024,
      });
      const abort = () => stream.destroy();
      signal.addEventListener("abort", abort, { once: true });
      stream.once("close", () => {
        signal.removeEventListener("abort", abort);
        void release().catch((cause) => logger.error(cause));
      });
      stream.on("error", (cause) => logger.error(`Folder "${id}" stream failed: ${cause.message}`));
      if (signal.aborted) stream.destroy();
      logger.info(
        `Folder "${id}" (File ${selected.map((file) => `"${file.id}"`).join(", ")}) downloaded by "${options.clientAddress}"`,
      );

      return {
        body: Readable.toWeb(stream, {
          strategy: { highWaterMark: 64 * 1024, size: (chunk) => chunk.byteLength },
        }) as ReadableStream<Uint8Array>,
        filename: archiveName(folder.name || defaultFolderName(files), format),
      };
    } catch (cause) {
      await release();
      throw cause;
    }
  });
}
