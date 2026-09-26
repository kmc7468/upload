import { zipTimestamp, zipTimestampExtra } from "../archive-time";
import { createReadStream } from "node:fs";

export interface ArchiveEntry {
  name: string;
  path: string;
  size: number;
  uploadedAt: number;
}

export type ArchiveEntries = Iterable<ArchiveEntry> | AsyncIterable<ArchiveEntry>;

const ZIP64_VERSION = 45;
const ZIP_STREAM_FLAGS = 0x0808; // UTF-8 names and a trailing data descriptor.
const ZIP32_MAX = 0xffffffff;
const ZIP64_DESCRIPTOR_SIZE = 24;
const TAR_BLOCK_SIZE = 512;

const crcTable = Array.from({ length: 256 }, (_, value) => {
  for (let bit = 0; bit < 8; bit++) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }

  return value >>> 0;
});

const uint64 = (value: number) => {
  const bytes = Buffer.alloc(8);
  bytes.writeBigUInt64LE(BigInt(value));
  return bytes;
};

const zipHeader = (signature: number, length: number) => {
  const header = Buffer.alloc(length);
  header.writeUInt32LE(signature);
  return header;
};

const zip64Extra = (values: number[]) => {
  const header = Buffer.alloc(4);
  header.writeUInt16LE(1); // ZIP64 extended information.
  header.writeUInt16LE(values.length * 8, 2);
  return Buffer.concat([header, ...values.map(uint64)]);
};

const localZipHeader = (nameLength: number, extraLength: number, uploadedAt: number) => {
  const header = zipHeader(0x04034b50, 30);
  header.writeUInt16LE(ZIP64_VERSION, 4);
  header.writeUInt16LE(ZIP_STREAM_FLAGS, 6);
  const timestamp = zipTimestamp(uploadedAt);
  header.writeUInt16LE(timestamp.time, 10);
  header.writeUInt16LE(timestamp.date, 12);
  header.writeUInt32LE(ZIP32_MAX, 18);
  header.writeUInt32LE(ZIP32_MAX, 22);
  header.writeUInt16LE(nameLength, 26);
  header.writeUInt16LE(extraLength, 28);
  return header;
};

const centralZipRecord = (
  name: Buffer,
  size: number,
  checksum: number,
  offset: number,
  uploadedAt: number,
) => {
  const extra = Buffer.concat([zip64Extra([size, size, offset]), zipTimestampExtra(uploadedAt)]);
  const header = zipHeader(0x02014b50, 46);
  header.writeUInt16LE(ZIP64_VERSION, 4);
  header.writeUInt16LE(ZIP64_VERSION, 6);
  header.writeUInt16LE(ZIP_STREAM_FLAGS, 8);
  const timestamp = zipTimestamp(uploadedAt);
  header.writeUInt16LE(timestamp.time, 12);
  header.writeUInt16LE(timestamp.date, 14);
  header.writeUInt32LE(checksum, 16);
  header.writeUInt32LE(ZIP32_MAX, 20);
  header.writeUInt32LE(ZIP32_MAX, 24);
  header.writeUInt16LE(name.length, 28);
  header.writeUInt16LE(extra.length, 30);
  header.writeUInt32LE(ZIP32_MAX, 42);
  return Buffer.concat([header, name, extra]);
};

function* zipEndRecords(count: number, centralOffset: number, centralSize: number) {
  const end64 = zipHeader(0x06064b50, 56);
  end64.writeBigUInt64LE(44n, 4);
  end64.writeUInt16LE(ZIP64_VERSION, 12);
  end64.writeUInt16LE(ZIP64_VERSION, 14);
  end64.writeBigUInt64LE(BigInt(count), 24);
  end64.writeBigUInt64LE(BigInt(count), 32);
  end64.writeBigUInt64LE(BigInt(centralSize), 40);
  end64.writeBigUInt64LE(BigInt(centralOffset), 48);
  yield end64;

  const locator = zipHeader(0x07064b50, 20);
  locator.writeBigUInt64LE(BigInt(centralOffset + centralSize), 8);
  locator.writeUInt32LE(1, 16);
  yield locator;

  // ZIP64 archives also include the legacy end record with sentinel values.
  const end = zipHeader(0x06054b50, 22);
  end.writeUInt16LE(0xffff, 8);
  end.writeUInt16LE(0xffff, 10);
  end.writeUInt32LE(ZIP32_MAX, 12);
  end.writeUInt32LE(ZIP32_MAX, 16);
  yield end;
}

// STORE writes the original bytes without compression. Only central-directory
// metadata is retained in memory; file content is read and yielded in chunks.
export async function* zip(entries: ArchiveEntries) {
  let offset = 0;
  const centralRecords: Buffer[] = [];

  for await (const entry of entries) {
    const name = Buffer.from(entry.name);
    const extra = Buffer.concat([
      zip64Extra([entry.size, entry.size]),
      zipTimestampExtra(entry.uploadedAt),
    ]);
    const header = localZipHeader(name.length, extra.length, entry.uploadedAt);
    yield header;
    yield name;
    yield extra;

    // A data descriptor lets the checksum be calculated while streaming.
    let checksum = 0xffffffff;
    for await (const chunk of createReadStream(entry.path)) {
      for (const byte of chunk as Buffer) {
        checksum = crcTable[(checksum ^ byte) & 255] ^ (checksum >>> 8);
      }
      yield chunk as Buffer;
    }
    checksum = (checksum ^ 0xffffffff) >>> 0;

    const descriptor = zipHeader(0x08074b50, 8);
    descriptor.writeUInt32LE(checksum, 4);
    yield descriptor;
    yield uint64(entry.size);
    yield uint64(entry.size);

    centralRecords.push(centralZipRecord(name, entry.size, checksum, offset, entry.uploadedAt));
    offset += header.length + name.length + extra.length + entry.size + ZIP64_DESCRIPTOR_SIZE;
  }

  const centralOffset = offset;
  for (const record of centralRecords) {
    yield record;
    offset += record.length;
  }

  yield* zipEndRecords(centralRecords.length, centralOffset, offset - centralOffset);
}

const tarHeader = (name: string, size: number, uploadedAt: number, type = "0") => {
  const header = Buffer.alloc(TAR_BLOCK_SIZE);
  header.write(name, 0, 100);
  header.write("0000600\0", 100); // Owner read/write permissions.
  header.write("0000000\0", 108); // uid
  header.write("0000000\0", 116); // gid
  header.write(size.toString(8).padStart(11, "0") + "\0", 124);
  header.write(
    Math.floor(uploadedAt / 1000)
      .toString(8)
      .padStart(11, "0") + "\0",
    136,
  );
  header.fill(32, 148, 156); // Checksum field is spaces while calculating the sum.
  header.write(type, 156);
  header.write("ustar\0", 257);
  header.write("00", 263);

  const checksum = header.reduce((sum, byte) => sum + byte, 0);
  header.write(checksum.toString(8).padStart(6, "0") + "\0 ", 148);
  return header;
};

const paxPath = (name: string) => {
  const value = `path=${name}\n`;
  let length = Buffer.byteLength(value) + 3;

  // The decimal length includes its own digits, the space and the UTF-8 value.
  while (Buffer.byteLength(`${length} ${value}`) !== length) {
    length = Buffer.byteLength(`${length} ${value}`);
  }

  return Buffer.from(`${length} ${value}`);
};

const tarPadding = (size: number) =>
  Buffer.alloc((TAR_BLOCK_SIZE - (size % TAR_BLOCK_SIZE)) % TAR_BLOCK_SIZE);

export async function* tar(entries: ArchiveEntries) {
  let index = 0;

  for await (const entry of entries) {
    // PAX preserves Unicode and paths longer than the USTAR header can hold.
    const pax = paxPath(entry.name);
    yield tarHeader(`PaxHeaders/${index}`, pax.length, entry.uploadedAt, "x");
    yield pax;
    yield tarPadding(pax.length);

    yield tarHeader(`file-${index}`, entry.size, entry.uploadedAt);
    for await (const chunk of createReadStream(entry.path)) {
      yield chunk as Buffer;
    }
    yield tarPadding(entry.size);
    index++;
  }

  yield Buffer.alloc(TAR_BLOCK_SIZE * 2);
}
