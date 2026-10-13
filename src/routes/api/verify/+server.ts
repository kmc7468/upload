import { error, json } from "@sveltejs/kit";
import { verifyFile } from "$lib/server/services/files";
import { verifyFolder } from "$lib/server/services/folders";
import type { RequestHandler } from "./$types";

interface Upload {
  kind: "file" | "folder";
  id: string;
  managementToken: string;
}

const MAX_UPLOADS = 1000;

const isUpload = (value: unknown): value is Upload => {
  const upload = value as Upload | null;
  return (
    typeof upload === "object" &&
    upload !== null &&
    (upload.kind === "file" || upload.kind === "folder") &&
    typeof upload.id === "string" &&
    typeof upload.managementToken === "string"
  );
};

// My Files checks every upload a browser remembers in one request. Answers come in the
// order asked, and only the owner of an upload learns that it exists. A malformed list is
// refused as a whole, so no upload is ever reported missing by mistake.
export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json().catch(() => error(400, "Invalid JSON."));
  const uploads: unknown = body?.uploads;
  if (!Array.isArray(uploads) || uploads.length > MAX_UPLOADS || !uploads.every(isUpload)) {
    error(400, "Invalid list of uploads.");
  }

  const results = await Promise.all(
    uploads.map(async ({ kind, id, managementToken }) => {
      const upload =
        kind === "folder"
          ? await verifyFolder(id, managementToken)
          : await verifyFile(id, managementToken);
      return upload ? { exists: true, ...upload } : { exists: false };
    }),
  );
  return json({ results });
};
