import { zipTimestamp, zipTimestampExtra } from "./archive-time.ts";

// Browser-side STORE/ZIP64 support for end-to-end encrypted folder downloads.
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const ZIP64_VERSION = 45;
const ZIP_UTF8_FLAG = 0x0800;
const ZIP32_MAX = 0xffffffff;
const LOCAL_HEADER_SIZE = 30;
const DATA_DESCRIPTOR_SIZE = 24;

interface StoredZipEntry {
  name: string;
  content: ArrayBuffer;
}

const createRecord = (length: number, signature: number) => {
  const bytes = new Uint8Array(length);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, signature, true);
  return { bytes, view };
};

const zip64Extra = (values: number[]) => {
  const { bytes, view } = createRecord(4 + values.length * 8, 0);
  view.setUint16(0, 1, true); // ZIP64 extended information.
  view.setUint16(2, values.length * 8, true);
  values.forEach((value, index) => view.setBigUint64(4 + index * 8, BigInt(value), true));
  return bytes;
};

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
    view.getUint32(offset, true) === 0x04034b50
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
  const timestamp = zipTimestamp(uploadedAt);
  const parts: BlobPart[] = [];
  const centralRecords: Uint8Array<ArrayBuffer>[] = [];
  let offset = 0;
  let centralSize = 0;

  for (const file of files) {
    const name = encoder.encode(file.name);
    const size = file.content.byteLength;
    const checksum = checksumOf(file.content);
    const localExtra = new Uint8Array([
      ...zip64Extra([size, size]),
      ...zipTimestampExtra(uploadedAt),
    ]);

    // Unlike the server's stream, decrypted bytes already have a known checksum.
    // It can be written directly into the local header without a descriptor.
    const local = createRecord(LOCAL_HEADER_SIZE, 0x04034b50);
    local.view.setUint16(4, ZIP64_VERSION, true);
    local.view.setUint16(6, ZIP_UTF8_FLAG, true);
    local.view.setUint16(10, timestamp.time, true);
    local.view.setUint16(12, timestamp.date, true);
    local.view.setUint32(14, checksum, true);
    local.view.setUint32(18, ZIP32_MAX, true);
    local.view.setUint32(22, ZIP32_MAX, true);
    local.view.setUint16(26, name.length, true);
    local.view.setUint16(28, localExtra.length, true);
    parts.push(local.bytes, name, localExtra, file.content);

    const centralExtra = new Uint8Array([
      ...zip64Extra([size, size, offset]),
      ...zipTimestampExtra(uploadedAt),
    ]);
    const central = createRecord(46, 0x02014b50);
    central.view.setUint16(4, ZIP64_VERSION, true);
    central.view.setUint16(6, ZIP64_VERSION, true);
    central.view.setUint16(8, ZIP_UTF8_FLAG, true);
    central.view.setUint16(12, timestamp.time, true);
    central.view.setUint16(14, timestamp.date, true);
    central.view.setUint32(16, checksum, true);
    central.view.setUint32(20, ZIP32_MAX, true);
    central.view.setUint32(24, ZIP32_MAX, true);
    central.view.setUint16(28, name.length, true);
    central.view.setUint16(30, centralExtra.length, true);
    central.view.setUint32(42, ZIP32_MAX, true);
    centralRecords.push(central.bytes, name, centralExtra);

    centralSize += central.bytes.length + name.length + centralExtra.length;
    offset += local.bytes.length + name.length + localExtra.length + size;
  }

  parts.push(...centralRecords);

  const end = createRecord(56, 0x06064b50);
  end.view.setBigUint64(4, 44n, true);
  end.view.setUint16(12, ZIP64_VERSION, true);
  end.view.setUint16(14, ZIP64_VERSION, true);
  end.view.setBigUint64(24, BigInt(files.length), true);
  end.view.setBigUint64(32, BigInt(files.length), true);
  end.view.setBigUint64(40, BigInt(centralSize), true);
  end.view.setBigUint64(48, BigInt(offset), true);

  const locator = createRecord(20, 0x07064b50);
  locator.view.setBigUint64(8, BigInt(offset + centralSize), true);
  locator.view.setUint32(16, 1, true);

  const legacyEnd = createRecord(22, 0x06054b50);
  legacyEnd.view.setUint16(8, 0xffff, true);
  legacyEnd.view.setUint16(10, 0xffff, true);
  legacyEnd.view.setUint32(12, ZIP32_MAX, true);
  legacyEnd.view.setUint32(16, ZIP32_MAX, true);

  parts.push(end.bytes, locator.bytes, legacyEnd.bytes);
  return new Blob(parts, { type: "application/zip" });
};
