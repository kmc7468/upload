// ZIP's legacy DOS fields store local time with two-second precision.
// The extended timestamp below preserves the actual instant across timezones.
export const zipTimestamp = (timestamp: number) => {
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
export const zipTimestampExtra = (timestamp: number) => {
  const seconds = Math.floor(timestamp / 1000);
  const hasUnixTime = seconds >= -0x80000000 && seconds <= 0x7fffffff;
  const bytes = new Uint8Array(hasUnixTime ? 45 : 36);
  const view = new DataView(bytes.buffer);
  view.setUint16(0, 0x000a, true);
  view.setUint16(2, 32, true);
  view.setUint16(8, 1, true); // NTFS time attribute.
  view.setUint16(10, 24, true);
  const fileTime = (BigInt(Math.floor(timestamp)) + 11644473600000n) * 10000n;
  // All archive-entry times use the folder's upload time.
  for (const offset of [12, 20, 28]) view.setBigUint64(offset, fileTime, true);

  if (hasUnixTime) {
    view.setUint16(36, 0x5455, true);
    view.setUint16(38, 5, true);
    view.setUint8(40, 1); // Only modification time is present.
    view.setInt32(41, seconds, true);
  }
  return bytes;
};
