import { ONE_KIBI, ONE_MEBI, ONE_GIBI } from "./constants";

// Small values keep one decimal, so 5,747 bytes reads as "5.6 KiB" rather than "6 KiB".
const scaled = (value: number, unit: string) =>
  `${value < 10 ? Math.round(value * 10) / 10 : Math.round(value)} ${unit}`;

export const formatSize = (size: number) => {
  if (size < ONE_KIBI) {
    return `${Math.round(size)} B`;
  } else if (size < ONE_MEBI) {
    return scaled(size / ONE_KIBI, "KiB");
  } else if (size < ONE_GIBI) {
    return scaled(size / ONE_MEBI, "MiB");
  } else {
    return scaled(size / ONE_GIBI, "GiB");
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

export const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;

// The interface is in English, so dates are too, whatever the browser's locale.
const dateTime = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });
const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export const formatDateTime = (date: Date | number) => dateTime.format(date);

export const formatExpiry = (expireAt: number, now: number) => {
  const minutes = Math.ceil((expireAt - now) / 60_000);
  if (minutes <= 0) return "Expired";
  if (minutes < 60) return `Expires ${relative.format(minutes, "minute")}`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `Expires ${relative.format(hours, "hour")}`;
  return `Expires ${relative.format(Math.round(hours / 24), "day")}`;
};
