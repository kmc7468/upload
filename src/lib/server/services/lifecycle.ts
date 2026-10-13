import { allFiles } from "../db/file";
import { deleteFolderRecords, expiredFolderIDs, folderFiles } from "../db/folder";
import { FILE_TYPES } from "../images";
import { cachedPath, removeStored, storedIDs, storedPath } from "../storage";

// Every file belongs to a folder, including single-file uploads, so folders are the
// unit of locking, retention and removal.
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

// Callers must hold the folder lock.
export async function removeFolder(id: string) {
  const files = await folderFiles(id);
  await deleteFolderRecords(id);
  const cleanup = () =>
    removeStored(
      files.flatMap((file) => [
        storedPath(file.id),
        ...FILE_TYPES.map((type) => cachedPath(file.id, type)),
      ]),
    );
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

export const discardFolder = (id: string) => withFolderLock(id, () => removeFolder(id));

export async function expireFolders() {
  for (const id of await expiredFolderIDs()) {
    await discardFolder(id);
  }
}

// Reconciles the upload directory with the database after a restart. Uploads live on
// a RAM disk, so a folder that lost any of its bytes is discarded as a whole.
export async function synchronizeWithDatabase() {
  const onDisk = new Set(await storedIDs());
  const records = await allFiles();
  const recorded = new Set(records.map((file) => file.id));

  await removeStored([...onDisk].filter((id) => !recorded.has(id)).map((id) => storedPath(id)));
  const broken = new Set(
    records.filter((file) => !onDisk.has(file.id)).map((file) => file.folderId),
  );
  for (const id of broken) {
    await discardFolder(id);
  }
}
