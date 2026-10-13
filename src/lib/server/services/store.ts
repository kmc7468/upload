import { error } from "@sveltejs/kit";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import db from "../db/kysely";
import { reserveID, releaseID } from "../ids";
import { FILE_EXPIRY } from "../loadenv";
import { storedPath, writeUpload } from "../storage";

export interface StoredFileAttributes {
  // Without a folder, the file gets a folder of its own.
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

export const managementToken = () => crypto.randomBytes(32).toString("hex");

// Writes the bytes first, then records the file. The IDs stay reserved until the
// records exist, so concurrent uploads cannot be assigned the same ID.
export const storeFile = async (
  body: ReadableStream<Uint8Array>,
  attributes: StoredFileAttributes,
) => {
  const fileID = await reserveID();
  let ownFolderID: string | undefined;

  try {
    const { hash, size } = await writeUpload(fileID, body);

    try {
      if (!attributes.folderId) ownFolderID = await reserveID();
      const folderId = attributes.folderId ?? ownFolderID!;
      const token = await db()
        .transaction()
        .execute(async (trx) => {
          if (ownFolderID) {
            const now = Date.now();
            await trx
              .insertInto("folder")
              .values({
                id: ownFolderID,
                name: null,
                managementToken: managementToken(),
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

      return { fileID, hash, size, managementToken: token };
    } catch (cause) {
      await fs.rm(storedPath(fileID), { force: true });
      throw cause;
    }
  } finally {
    releaseID(fileID);
    if (ownFolderID) releaseID(ownFolderID);
  }
};
