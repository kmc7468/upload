import { ONE_KIBI, ONE_MEBI, ONE_GIBI } from "./constants";

export const formatThroughput = (throughput: number) => {
  if (throughput < ONE_KIBI) {
    return `${throughput} B/s`;
  } else if (throughput < ONE_MEBI) {
    return `${Math.round(throughput / ONE_KIBI)} KiB/s`;
  } else if (throughput < ONE_GIBI) {
    return `${Math.round(throughput / ONE_MEBI)} MiB/s`;
  } else {
    return `${Math.round(throughput / ONE_GIBI)} GiB/s`;
  }
};