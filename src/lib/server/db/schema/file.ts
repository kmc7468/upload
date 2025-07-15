import type { Selectable, Insertable, Updateable } from "kysely";

export interface FileTable {
  id: string,
  uploadedAt: number, // timestamp
  expireAt: number, // timestamp
  managementToken: string,

  name: string,
  contentType: string,

  isDisposable: number, // boolean
  isEncrypted: number, // boolean
}

export type File = Selectable<FileTable>;
export type NewFile = Insertable<FileTable>;
export type FileUpdate = Updateable<FileTable>;