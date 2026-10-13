import { decodeStringFromBase64, encodeStringInBase64 } from "./cipher";

// Files and folders share the same /<id>/<name> download URL.
export const downloadPath = (id: string, name: string) => `/${id}/${encodeURIComponent(name)}`;
export const filePagePath = (id: string) => `/app/file/${id}`;
export const folderPagePath = (id: string) => `/app/folder/${id}`;

// Encrypted files are shared through their page, which decrypts them in the browser.
export const fileSharePath = (file: { id: string; name: string; isEncrypted: boolean }) =>
  file.isEncrypted ? filePagePath(file.id) : downloadPath(file.id, file.name);

// The server converts the image and gives the download the matching extension.
export const convertedPath = (path: string, type: "jpg" | "png") => `${path}?${type}`;

// Browsers never send the fragment, so the passphrase stays on the client.
export const withPassphrase = (url: string, passphrase: string) =>
  `${url}#${encodeStringInBase64(passphrase)}`;
export const passphraseFromHash = (hash: string) =>
  hash ? decodeStringFromBase64(hash.slice(1)) : "";
