import type { FileTable } from "./file";
import type { FolderTable } from "./folder";

export type * from "./file";
export type * from "./folder";

export default interface Schema {
  file: FileTable;
  folder: FolderTable;
}
