import {
  centralRecord,
  DATA_DESCRIPTOR_SIZE,
  endRecords,
  LOCAL_HEADER_SIGNATURE,
  LOCAL_HEADER_SIZE,
  localHeader,
  ZIP_UTF8,
} from "./zip-format";

// Browser-side STORE/ZIP64 support for end-to-end encrypted folder downloads.
const encoder = new TextEncoder();
const decoder = new TextDecoder();

interface StoredZipEntry {
  name: string;
  content: ArrayBuffer;
}

const crcTable = Array.from({ length: 256 }, (_, value) => {
  for (let bit = 0; bit < 8; bit++) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }

  return value >>> 0;
});

const checksumOf = (content: ArrayBuffer) => {
  let checksum = 0xffffffff;
  for (const byte of new Uint8Array(content)) {
    checksum = crcTable[(checksum ^ byte) & 255] ^ (checksum >>> 8);
  }

  return (checksum ^ 0xffffffff) >>> 0;
};

// Reads the uncompressed ZIP64 layout emitted by our streaming server. This is
// deliberately not a general ZIP reader: each local entry has a ZIP64 size field
// followed by its content and a 24-byte data descriptor with its signature.
export const readStoredZip = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const files: StoredZipEntry[] = [];
  let offset = 0;

  while (
    offset + LOCAL_HEADER_SIZE <= bytes.length &&
    view.getUint32(offset, true) === LOCAL_HEADER_SIGNATURE
  ) {
    if (view.getUint16(offset + 8, true) !== 0) {
      throw new Error("Unsupported ZIP compression");
    }

    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const nameOffset = offset + LOCAL_HEADER_SIZE;
    const name = decoder.decode(bytes.subarray(nameOffset, nameOffset + nameLength));
    const contentOffset = nameOffset + nameLength + extraLength;
    const size = Number(view.getBigUint64(nameOffset + nameLength + 4, true));

    if (
      !Number.isSafeInteger(size) ||
      size < 0 ||
      contentOffset + size + DATA_DESCRIPTOR_SIZE > bytes.length
    ) {
      throw new Error("Invalid ZIP entry");
    }

    files.push({ name, content: buffer.slice(contentOffset, contentOffset + size) });
    offset = contentOffset + size + DATA_DESCRIPTOR_SIZE;
  }

  if (!files.length) throw new Error("Empty archive");
  return files;
};

export const createStoredZip = (files: StoredZipEntry[], uploadedAt = Date.now()) => {
  const parts: BlobPart[] = [];
  const centralRecords: Uint8Array<ArrayBuffer>[] = [];
  let offset = 0;
  let centralSize = 0;

  for (const file of files) {
    // Unlike the server's stream, decrypted bytes already have a known checksum.
    // It can be written directly into the local header without a descriptor.
    const entry = {
      name: encoder.encode(file.name),
      size: file.content.byteLength,
      uploadedAt,
      flags: ZIP_UTF8,
      checksum: checksumOf(file.content),
    };
    const header = localHeader(entry);
    parts.push(header, file.content);

    const record = centralRecord(entry, offset);
    centralRecords.push(record);
    centralSize += record.length;
    offset += header.length + entry.size;
  }

  parts.push(...centralRecords, endRecords(files.length, offset, centralSize));
  return new Blob(parts, { type: "application/zip" });
};
