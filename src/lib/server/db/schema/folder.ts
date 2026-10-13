import type { Selectable, Insertable, Updateable } from "kysely";

export interface FolderTable {
  id: string;
  name: string | null;
  managementToken: string;
  uploadedAt: number;
  expireAt: number;
  isDisposable: number;
  isEncrypted: number;
  expectedCount: number;
  ready: number;
}

export type Folder = Selectable<FolderTable>;
export type NewFolder = Insertable<FolderTable>;
export type FolderUpdate = Updateable<FolderTable>;
