import crypto from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import db from "./db/kysely";
import { ID_CHARS, ID_LENGTH, UPLOAD_DIR } from "./loadenv";

// Files and folders share public URLs. Reserve IDs through the entire write so
// concurrent uploads cannot reuse an ID before its database record exists.
const reserved = new Set<string>();

export async function reserveID() {
  while (true) {
    const id = Array.from(
      { length: ID_LENGTH },
      () => ID_CHARS[crypto.randomInt(ID_CHARS.length)],
    ).join("");
    if (reserved.has(id)) continue;
    reserved.add(id);
    try {
      if (
        existsSync(path.join(UPLOAD_DIR, id)) ||
        (await db!.selectFrom("file").select("id").where("id", "=", id).executeTakeFirst()) ||
        (await db!.selectFrom("folder").select("id").where("id", "=", id).executeTakeFirst())
      ) {
        reserved.delete(id);
        continue;
      }
      return id;
    } catch (cause) {
      reserved.delete(id);
      throw cause;
    }
  }
}

export const releaseID = (id: string) => {
  reserved.delete(id);
};
