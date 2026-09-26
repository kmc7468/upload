import type { FileTable } from "./file";

export default interface Schema {
  file: FileTable;
  folder: FolderTable;
}

export interface FolderTable {
  name: string | null;
  id: string;
  managementToken: string;
  uploadedAt: number;
  expireAt: number;
  isDisposable: number;
  isEncrypted: number;
  expectedCount: number;
  ready: number;
}
