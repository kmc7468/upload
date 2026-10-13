import { text } from "@sveltejs/kit";
import { MAX_FILE_SIZE } from "$lib/constants";
import { FILE_EXPIRY } from "$lib/server/loadenv";
import { formatSize } from "$lib/utils";
import type { RequestHandler } from "./$types";

const formatDuration = (milliseconds: number) => {
  const seconds = Math.round(milliseconds / 1000);
  const [value, unit] =
    seconds % 3600 === 0
      ? [seconds / 3600, "hour"]
      : seconds % 60 === 0
        ? [seconds / 60, "minute"]
        : [seconds, "second"];
  return `${value} ${unit}${value === 1 ? "" : "s"}`;
};

const usage = (origin: string) => `Minchan's Upload

Upload a file:
  curl -T photo.jpg ${origin}/

Upload options go before the file name, and can be combined as /de/:
  curl -T photo.jpg ${origin}/d/
      Single Download: deleted after the first download.
  openssl enc -e -aes-256-cbc -pbkdf2 < photo.jpg | curl -T - ${origin}/e/photo.jpg
      End-to-end encryption with a passphrase.

Download:
  curl -OJ ${origin}/<id>
  curl -OJ "${origin}/<id>?jpg"
      Convert an image to JPEG first (or ?png).
  curl -s ${origin}/<id> | openssl enc -d -aes-256-cbc -pbkdf2 > photo.jpg
      Decrypt an end-to-end encrypted file.

Delete:
  curl -X DELETE -H "X-Management-Token: <token>" ${origin}/<id>
      The token is in the X-Management-Token header of the upload response.
      Add -i to the upload command to see it.

Files are deleted after ${formatDuration(FILE_EXPIRY)}. The size limit is ${formatSize(MAX_FILE_SIZE)}.
Open ${origin}/app in a browser to upload multiple files.
`;

// Browsers asking for text/html get the +page redirect to /app instead.
export const GET: RequestHandler = ({ url }) =>
  text(usage(url.origin), {
    headers: { "Content-Type": "text/plain; charset=utf-8", Vary: "Accept" },
  });
