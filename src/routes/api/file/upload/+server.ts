import { error, text } from "@sveltejs/kit";
import crypto from "crypto";
import z from "zod";
import { MAX_FILE_SIZE } from "$lib/constants";
import { uploadFile } from "$lib/server/filesystem";
import logger from "$lib/server/logger";
import type { RequestHandler } from "./$types";

const optionsSchema = z.object({
  name: z.string(),
  contentType: z.string().nullable().optional(),
  isDisposable: z.boolean().nullable().optional(),
  isEncrypted: z.boolean().nullable().optional(),
});

const hash = (buffer: Buffer) => {
  return crypto.createHash("sha256").update(buffer).digest("hex");
};

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
  const form = await request.formData();

  const options = form.get("options") as string | null;
  if (!options) {
    error(400);
  }

  const parsedOptions = await optionsSchema.safeParseAsync(JSON.parse(options));
  if (!parsedOptions.success) {
    error(400);
  }
  const {
    name: fileName,
    contentType: fileType,
    isDisposable,
    isEncrypted
  } = parsedOptions.data;

  const file = form.get("file") as File | null;
  if (!file) {
    error(400);
  } else if (file.size > MAX_FILE_SIZE) {
    error(413);
  }

  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const fileHash = hash(fileBuffer);
  const fileID = await uploadFile(fileBuffer, {
    name: fileName,
    contentType: fileType || "application/octet-stream",

    isDisposable: isDisposable || false,
    isEncrypted: isEncrypted || false,
  });

  logger.info(
    `File "${fileName}" uploaded as "${fileID}" with hash "${fileHash}" by "${getClientAddress()}" (${file.size} bytes)`);

  return text(fileID, { headers: { "Content-Type": "text/plain" } });
};