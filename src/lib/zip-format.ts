// ZIP64 STORE records shared by the server's streaming archives and the browser's
// archive of decrypted files. All archive-entry times use the folder's upload time.
export const ZIP_UTF8 = 0x0800;
// The checksum and sizes follow the entry's content instead of preceding it.
export const ZIP_DATA_DESCRIPTOR = 0x0008;
export const LOCAL_HEADER_SIGNATURE = 0x04034b50;
export const LOCAL_HEADER_SIZE = 30;
export const DATA_DESCRIPTOR_SIZE = 24;

const ZIP64_VERSION = 45;
const ZIP32_MAX = 0xffffffff;

const record = (length: number, signature: number) => {
  const bytes = new Uint8Array(length);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, signature, true);
  return { bytes, view };
};

const concat = (...parts: Uint8Array[]) => {
  const result = new Uint8Array(parts.reduce((length, part) => length + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
};

// ZIP's legacy DOS fields store local time with two-second precision.
// The extended timestamp below preserves the actual instant across timezones.
const dosTimestamp = (timestamp: number) => {
  const minimum = new Date(1980, 0, 1).getTime();
  const maximum = new Date(2107, 11, 31, 23, 59, 58).getTime();
  const date = new Date(Math.min(maximum, Math.max(minimum, timestamp)));
  return {
    date: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
  };
};

// NTFS and Info-ZIP timestamps preserve UTC instants for Windows and Unix readers.
// Both fields are shared by local and central headers.
const timestampExtra = (timestamp: number) => {
  const seconds = Math.floor(timestamp / 1000);
  const hasUnixTime = seconds >= -0x80000000 && seconds <= 0x7fffffff;
  const bytes = new Uint8Array(hasUnixTime ? 45 : 36);
  const view = new DataView(bytes.buffer);
  view.setUint16(0, 0x000a, true);
  view.setUint16(2, 32, true);
  view.setUint16(8, 1, true); // NTFS time attribute.
  view.setUint16(10, 24, true);
  const fileTime = (BigInt(Math.floor(timestamp)) + 11644473600000n) * 10000n;
  for (const offset of [12, 20, 28]) view.setBigUint64(offset, fileTime, true);

  if (hasUnixTime) {
    view.setUint16(36, 0x5455, true);
    view.setUint16(38, 5, true);
    view.setUint8(40, 1); // Only modification time is present.
    view.setInt32(41, seconds, true);
  }
  return bytes;
};

const zip64Extra = (values: number[]) => {
  const { bytes, view } = record(4 + values.length * 8, 0);
  view.setUint16(0, 1, true); // ZIP64 extended information.
  view.setUint16(2, values.length * 8, true);
  values.forEach((value, index) => view.setBigUint64(4 + index * 8, BigInt(value), true));
  return bytes;
};

export interface ZipEntry {
  // UTF-8 encoded.
  name: Uint8Array;
  size: number;
  uploadedAt: number;
  flags: number;
  // Zero when a data descriptor carries it instead.
  checksum: number;
}

// The local header, name and extra fields that precede an entry's content.
export const localHeader = (entry: ZipEntry) => {
  const extra = concat(zip64Extra([entry.size, entry.size]), timestampExtra(entry.uploadedAt));
  const { bytes, view } = record(LOCAL_HEADER_SIZE, LOCAL_HEADER_SIGNATURE);
  const timestamp = dosTimestamp(entry.uploadedAt);
  view.setUint16(4, ZIP64_VERSION, true);
  view.setUint16(6, entry.flags, true);
  view.setUint16(10, timestamp.time, true);
  view.setUint16(12, timestamp.date, true);
  view.setUint32(14, entry.checksum, true);
  view.setUint32(18, ZIP32_MAX, true);
  view.setUint32(22, ZIP32_MAX, true);
  view.setUint16(26, entry.name.length, true);
  view.setUint16(28, extra.length, true);
  return concat(bytes, entry.name, extra);
};

export const dataDescriptor = (checksum: number, size: number) => {
  const { bytes, view } = record(DATA_DESCRIPTOR_SIZE, 0x08074b50);
  view.setUint32(4, checksum, true);
  view.setBigUint64(8, BigInt(size), true);
  view.setBigUint64(16, BigInt(size), true);
  return bytes;
};

export const centralRecord = (entry: ZipEntry, offset: number) => {
  const extra = concat(
    zip64Extra([entry.size, entry.size, offset]),
    timestampExtra(entry.uploadedAt),
  );
  const { bytes, view } = record(46, 0x02014b50);
  const timestamp = dosTimestamp(entry.uploadedAt);
  view.setUint16(4, ZIP64_VERSION, true);
  view.setUint16(6, ZIP64_VERSION, true);
  view.setUint16(8, entry.flags, true);
  view.setUint16(12, timestamp.time, true);
  view.setUint16(14, timestamp.date, true);
  view.setUint32(16, entry.checksum, true);
  view.setUint32(20, ZIP32_MAX, true);
  view.setUint32(24, ZIP32_MAX, true);
  view.setUint16(28, entry.name.length, true);
  view.setUint16(30, extra.length, true);
  view.setUint32(42, ZIP32_MAX, true);
  return concat(bytes, entry.name, extra);
};

export const endRecords = (count: number, centralOffset: number, centralSize: number) => {
  const end64 = record(56, 0x06064b50);
  end64.view.setBigUint64(4, 44n, true);
  end64.view.setUint16(12, ZIP64_VERSION, true);
  end64.view.setUint16(14, ZIP64_VERSION, true);
  end64.view.setBigUint64(24, BigInt(count), true);
  end64.view.setBigUint64(32, BigInt(count), true);
  end64.view.setBigUint64(40, BigInt(centralSize), true);
  end64.view.setBigUint64(48, BigInt(centralOffset), true);

  const locator = record(20, 0x07064b50);
  locator.view.setBigUint64(8, BigInt(centralOffset + centralSize), true);
  locator.view.setUint32(16, 1, true);

  // ZIP64 archives also include the legacy end record with sentinel values.
  const end = record(22, 0x06054b50);
  end.view.setUint16(8, 0xffff, true);
  end.view.setUint16(10, 0xffff, true);
  end.view.setUint32(12, ZIP32_MAX, true);
  end.view.setUint32(16, ZIP32_MAX, true);

  return concat(end64.bytes, locator.bytes, end.bytes);
};
