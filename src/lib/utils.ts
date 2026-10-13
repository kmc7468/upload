import { ONE_KIBI, ONE_MEBI, ONE_GIBI } from "./constants";

export const formatSize = (size: number) => {
  if (size < ONE_KIBI) {
    return `${size} B`;
  } else if (size < ONE_MEBI) {
    return `${Math.round(size / ONE_KIBI)} KiB`;
  } else if (size < ONE_GIBI) {
    return `${Math.round(size / ONE_MEBI)} MiB`;
  } else {
    return `${Math.round(size / ONE_GIBI)} GiB`;
  }
};

export const formatThroughput = (throughput: number) => `${formatSize(throughput)}/s`;

export const formatDuration = (milliseconds: number) => {
  const seconds = Math.round(milliseconds / 1000);
  const [value, unit] =
    seconds % 3600 === 0
      ? [seconds / 3600, "hour"]
      : seconds % 60 === 0
        ? [seconds / 60, "minute"]
        : [seconds, "second"];
  return `${value} ${unit}${value === 1 ? "" : "s"}`;
};
