import type { Selectable, Insertable, Updateable } from "kysely";

export interface FileTable {
  id: string,
  uploadedAt: number, // timestamp
  expireAt: number, // timestamp

  fileName: string,
  contentType: string | null,

  isDisposable: number, // boolean
}

export type File = Selectable<FileTable>;
export type NewFile = Insertable<FileTable>;
export type FileUpdate = Updateable<FileTable>;