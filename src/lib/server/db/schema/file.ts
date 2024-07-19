import type { Selectable, Insertable, Updateable } from "kysely";

export interface FileTable {
  id: string,
  uploadedAt: Date,
  expireAt: Date,

  fileName: string,
  contentType: string | null,

  isDisposable: boolean,
}

export type File = Selectable<FileTable>;
export type NewFile = Insertable<FileTable>;
export type FileUpdate = Updateable<FileTable>;