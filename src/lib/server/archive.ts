import { createReadStream } from "node:fs";
import { crc32 } from "node:zlib";
import {
  centralRecord,
  dataDescriptor,
  endRecords,
  localHeader,
  ZIP_DATA_DESCRIPTOR,
  ZIP_UTF8,
  type ZipEntry,
} from "$lib/zip-format";

export interface ArchiveEntry {
  name: string;
  path: string;
  size: number;
  uploadedAt: number;
}

export type ArchiveEntries = Iterable<ArchiveEntry> | AsyncIterable<ArchiveEntry>;

const TAR_BLOCK_SIZE = 512;

// STORE writes the original bytes without compression. Only central-directory
// metadata is retained in memory; file content is read and yielded in chunks.
export async function* zip(entries: ArchiveEntries) {
  let offset = 0;
  const central: { entry: ZipEntry; offset: number }[] = [];

  for await (const { name, path, size, uploadedAt } of entries) {
    // A data descriptor lets the checksum be calculated while streaming.
    const entry: ZipEntry = {
      name: Buffer.from(name),
      size,
      uploadedAt,
      flags: ZIP_UTF8 | ZIP_DATA_DESCRIPTOR,
      checksum: 0,
    };
    const header = localHeader(entry);
    yield header;

    let checksum = 0;
    for await (const chunk of createReadStream(path)) {
      checksum = crc32(chunk as Buffer, checksum);
      yield chunk as Buffer;
    }
    const descriptor = dataDescriptor(checksum, size);
    yield descriptor;

    central.push({ entry: { ...entry, checksum }, offset });
    offset += header.length + size + descriptor.length;
  }

  const centralOffset = offset;
  for (const { entry, offset: entryOffset } of central) {
    const record = centralRecord(entry, entryOffset);
    yield record;
    offset += record.length;
  }

  yield endRecords(central.length, centralOffset, offset - centralOffset);
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
