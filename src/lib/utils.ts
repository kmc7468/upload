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
