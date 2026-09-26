// Capture entries during the drop event, before the browser protects its data store.
export const collectDroppedFiles = async (transfer: DataTransfer, limit = 1000) => {
  const items = Array.from(transfer.items).filter((item) => item.kind === "file");
  const sources = items.map((item) => ({
    entry: item.webkitGetAsEntry?.(),
    file: item.getAsFile(),
  }));
  const fallback = Array.from(transfer.files);
  const files: File[] = [];
  const append = (file: File) => {
    if (files.length >= limit) throw new Error(`Choose up to ${limit} files.`);
    files.push(file);
  };

  const visit = async (entry: FileSystemEntry): Promise<void> => {
    if (entry.isFile) {
      const file = await new Promise<File>((resolve, reject) =>
        (entry as FileSystemFileEntry).file(resolve, reject),
      );
      append(file);
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      // A directory can arrive in multiple batches (often 100 entries each).
      while (true) {
        const entries = await new Promise<FileSystemEntry[]>((resolve, reject) =>
          reader.readEntries(resolve, reject),
        );
        if (!entries.length) break;
        for (const child of entries) await visit(child);
      }
    }
  };

  if (sources.length) {
    for (const { entry, file } of sources) {
      if (entry) await visit(entry);
      else if (file) append(file);
      else throw new Error("Could not read a dropped item.");
    }
  } else {
    for (const file of fallback) append(file);
  }
  const folderName =
    sources.length === 1 && sources[0].entry?.isDirectory ? sources[0].entry.name : undefined;
  return { files, folderName };
};
