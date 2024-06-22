import fs from "fs";
import path from "path";
import { UPLOAD_DIR, ID_CHARS, ID_LENGTH } from "$lib/server/loadenv";

const fileExtensions = ["", ".d"];

const generateRandomID = (length: number) => {
  return Array.from({ length }, () => ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)]).join("");
};

const generateUniqueID = () => {
  while (true) {
    const id = generateRandomID(ID_LENGTH);
    const candidates = fileExtensions.map(ext => path.join(UPLOAD_DIR, id + ext));
    if (!candidates.some(fs.existsSync)) {
      return id;
    }
  }
};

export const saveFile = async (file: Buffer, isDisposable: boolean) => {
  const fileID = generateUniqueID();
  const targetFileName = fileID + (isDisposable ? ".d" : "");

  fs.writeFileSync(path.join(UPLOAD_DIR, targetFileName), file, { mode: 0o600 });

  return { fileID, targetFileName };
};