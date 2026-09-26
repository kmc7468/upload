import { error, isHttpError, type Cookies } from "@sveltejs/kit";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import { Readable } from "node:stream";
import path from "node:path";
import { MAX_CONVERTIBLE_IMAGE_SIZE } from "$lib/constants";
import { archiveName } from "$lib/archive-name";
import { reserveID, releaseID } from "./ids";
import db from "./db/kysely";
import { cachedImagePath, uploadFile, type FileType } from "./filesystem";
import { CACHE_DIR, UPLOAD_DIR, FILE_EXPIRY } from "./loadenv";
import logger from "./logger";
import { zip, tar, type ArchiveEntry } from "./archive";

const locks = new Map<string, Promise<unknown>>();

export async function withFolderLock<T>(id: string, action: () => Promise<T>): Promise<T> {
  const previous = locks.get(id) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(action);
  locks.set(id, next);
  try {
    return await next;
  } finally {
    if (locks.get(id) === next) {
      locks.delete(id);
    }
  }
}

export const findFolder = (id: string) =>
  db!
    .selectFrom("folder")
    .selectAll()
    .where("id", "=", id)
    .where("expireAt", ">", Date.now())
    .executeTakeFirst();

export const folderFiles = (id: string) =>
  db!
    .selectFrom("file")
    .selectAll()
    .where("folderId", "=", id)
    .orderBy("position")
    .orderBy("id")
    .execute();

export async function createFolder(count: number, disposable: boolean, encrypted: boolean) {
  if (!Number.isInteger(count) || count < 2 || count > 1000) {
    error(400, "Choose between 2 and 1000 files.");
  }
  const id = await reserveID();
  try {
    const now = Date.now();
    const folder = {
      id,
      managementToken: crypto.randomBytes(32).toString("hex"),
      uploadedAt: now,
      expireAt: now + FILE_EXPIRY,
      isDisposable: +disposable,
      isEncrypted: +encrypted,
      expectedCount: count,
      ready: 0,
      name: null,
    };
    await db!.insertInto("folder").values(folder).execute();
    return folder;
  } finally {
    releaseID(id);
  }
}

async function managedFolder(id: string, token: string | null) {
  const folder = await findFolder(id);
  if (!folder) {
    error(404);
  }
  if (!token || token !== folder.managementToken) {
    error(403);
  }
  return folder;
}

export async function addFolderFile(id: string, request: Request, address: string) {
  return withFolderLock(id, async () => {
    const folder = await managedFolder(id, request.headers.get("X-Management-Token"));
    const members = await folderFiles(id);
    if (folder.ready || members.length >= folder.expectedCount) {
      error(409);
    }
    const encodedName = request.headers.get("X-Content-Name");
    if (!encodedName) {
      error(400);
    }
    const body =
      request.body ??
      (request.headers.get("Content-Length") === "0"
        ? new ReadableStream<Uint8Array>({
            start(controller) {
              controller.close();
            },
          })
        : null);
    if (!body) {
      error(400);
    }
    let name: string;
    try {
      name = decodeURIComponent(encodedName);
    } catch {
      error(400);
    }
    if (!name || Buffer.byteLength(name) > 4096) {
      error(400);
    }
    const result = await uploadFile(body, {
      name,
      contentType: request.headers.get("Content-Type") || "application/octet-stream",
      isDisposable: !!folder.isDisposable,
      isEncrypted: !!folder.isEncrypted,
      folderId: id,
      position: members.length,
    });
    const size = (await fs.stat(path.join(UPLOAD_DIR, result.fileID))).size;
    logger.info(
      `File ${JSON.stringify(name)} uploaded as "${result.fileID}" in folder "${id}" with hash "${result.fileHash}" by "${address}" (${size} bytes)`,
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
    await db!.updateTable("folder").set({ ready: 1 }).where("id", "=", id).execute();
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
    await db!.updateTable("folder").set({ name: normalized }).where("id", "=", id).execute();
    return { name: normalized };
  });
}

// Keep file bytes alive for in-flight streams even if their folder is deleted
// or expires. Metadata disappears immediately; unlinking waits for the last reader.
const readers = new Map<string, { count: number; cleanup?: () => Promise<void> }>();
export function retainFolder(id: string) {
  const state = readers.get(id) ?? { count: 0 };
  state.count++;
  readers.set(id, state);
  let released = false;
  return async () => {
    if (released) return;

    released = true;
    if (--state.count === 0) {
      readers.delete(id);
      await state.cleanup?.();
    }
  };
}

export async function removeFolder(id: string) {
  const files = await folderFiles(id);
  await db!.transaction().execute(async (trx) => {
    await trx.deleteFrom("file").where("folderId", "=", id).execute();
    await trx.deleteFrom("folder").where("id", "=", id).execute();
  });
  const cleanup = () =>
    Promise.all(
      files
        .flatMap((file) => [
          path.join(UPLOAD_DIR, file.id),
          ...["jpeg", "png"].map((type) => path.join(CACHE_DIR, `${file.id}.${type}`)),
        ])
        .map((file) => fs.rm(file, { force: true })),
    ).then(() => {});
  const active = readers.get(id);
  if (active) {
    // A second cleanup after metadata was removed must not replace the file list.
    if (files.length) {
      active.cleanup = cleanup;
    }
  } else {
    await cleanup();
  }
}

export async function deleteFolder(id: string, token: string | null) {
  return withFolderLock(id, async () => {
    await managedFolder(id, token);
    await removeFolder(id);
  });
}

export async function expireFolders() {
  const folders = await db!
    .selectFrom("folder")
    .select("id")
    .where("expireAt", "<=", Date.now())
    .execute();
  for (const folder of folders) {
    await withFolderLock(folder.id, () => removeFolder(folder.id));
  }
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
        size: (await fs.stat(path.join(UPLOAD_DIR, file.id))).size,
      })),
    ),
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

export async function downloadFolder(id: string, request: Request, url: URL, address: string) {
  return withFolderLock(id, async () => {
    const folder = await findFolder(id);
    if (!folder?.ready) {
      error(404);
    }
    const format =
      (url.searchParams.has("zip") ? "zip" : url.searchParams.get("format")) ||
      (/curl\//i.test(request.headers.get("User-Agent") || "") ? "tar" : "zip");
    if (format !== "zip" && format !== "tar") {
      error(400);
    }
    const conversion =
      url.searchParams.get("conv") ||
      (url.searchParams.has("jpg") ? "jpg" : url.searchParams.has("png") ? "png" : null);
    if (conversion && !["jpg", "jpeg", "png"].includes(conversion)) {
      error(400);
    }
    const type = (conversion === "jpg" ? "jpeg" : conversion) as FileType | null;
    const files = await folderFiles(id);
    const requested = url.searchParams.getAll("file");
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
      error(400);
    }
    const used = new Set<string>();
    const originals: ArchiveEntry[] = [];
    for (const file of selected) {
      const filePath = path.join(UPLOAD_DIR, file.id);
      const size = (await fs.stat(filePath)).size;
      if (type && size > MAX_CONVERTIBLE_IMAGE_SIZE) error(413);
      const name = type
        ? file.name.replace(/\.[^.]*$/, "") + (type === "jpeg" ? ".jpg" : ".png")
        : file.name;
      originals.push({
        name: safeName(name, used),
        path: filePath,
        size,
        uploadedAt: folder.uploadedAt,
      });
    }
    async function convertedEntry(index: number): Promise<ArchiveEntry> {
      if (!type) return originals[index];
      const converted = await cachedImagePath(selected[index].id, type);
      return { ...originals[index], path: converted, size: (await fs.stat(converted)).size };
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
        await Promise.all(
          selected.map((file) =>
            fs.rm(path.join(CACHE_DIR, `${file.id}.${type}`), { force: true }),
          ),
        );
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
      request.signal.addEventListener("abort", abort, { once: true });
      stream.once("close", () => {
        request.signal.removeEventListener("abort", abort);
        void release().catch((cause) => logger.error(cause));
      });
      stream.on("error", (cause) => logger.error(`Folder "${id}" stream failed: ${cause.message}`));
      if (request.signal.aborted) stream.destroy();
      logger.info(
        `Folder "${id}" (File ${selected.map((file) => `"${file.id}"`).join(", ")}) downloaded by "${address}"`,
      );
      const filename = archiveName(folder.name || defaultFolderName(files), format);
      // curl -J uses filename rather than filename*. Send UTF-8 bytes in the
      // quoted fallback too, while browsers can use the RFC 5987 parameter.
      const downloadFilename = Buffer.from(filename, "utf8").toString("latin1");
      const encodedFilename = encodeURIComponent(filename).replace(
        /[!'()*]/g,
        (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
      );
      return new Response(
        Readable.toWeb(stream, {
          strategy: { highWaterMark: 64 * 1024, size: (chunk) => chunk.byteLength },
        }) as ReadableStream<Uint8Array>,
        {
          headers: {
            "Content-Type": format === "zip" ? "application/zip" : "application/x-tar",
            "Content-Disposition": `attachment; filename="${downloadFilename}"; filename*=UTF-8''${encodedFilename}`,
            "Cache-Control": "no-store",
            "X-Accel-Buffering": "no",
            Vary: "User-Agent",
          },
        },
      );
    } catch (cause) {
      await release();
      throw cause;
    }
  });
}

export const discardFolder = (id: string) => withFolderLock(id, () => removeFolder(id));

export async function folderDownloadResponse(
  id: string,
  request: Request,
  url: URL,
  cookies: Cookies,
  getClientAddress: () => string,
) {
  const token = url.searchParams.get("downloadToken");
  const notify = (state: "started" | "failed") => {
    if (token && /^[0-9a-f-]{36}$/i.test(token)) {
      cookies.set(`folder-download-${token}`, state, {
        path: `/app/folder/${id}`,
        httpOnly: false,
        secure: url.protocol === "https:",
        sameSite: "strict",
        maxAge: 60,
      });
    }
  };
  try {
    const response = await downloadFolder(id, request, url, getClientAddress());
    notify("started");
    return response;
  } catch (cause) {
    notify("failed");
    throw cause;
  }
}
