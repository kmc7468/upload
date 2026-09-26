// A shared, portable download name for server archives and browser-decrypted ZIPs.
export function archiveName(name: string, format: "zip" | "tar") {
  const stem = name
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f\x7f<>:"/\\|?*]/g, "_")
    .replace(/[. ]+$/, "")
    .trim();
  return `${stem || "Folder"}.${format}`;
}
