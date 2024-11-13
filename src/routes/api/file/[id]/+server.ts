import { error } from "@sveltejs/kit";
import z from "zod";
import { downloadFile } from "$lib/server/filesystem";
import { ID_REGEX } from "$lib/server/loadenv";
import logger from "$lib/server/logger";
import type { RequestHandler } from "./$types";

const requestSchema = z.object({
  requiredType: z.string().nullable().optional(),
});

const determineRequiredType = (requiredType: string | null | undefined) => {
  switch (requiredType) {
    case "jpeg":
    case "png":
      return requiredType;
    case "jpg":
      return "jpeg";
    default:
      return undefined;
  }
}

export const GET: RequestHandler = async ({ params, url, getClientAddress }) => {
  const fileID = params.id;
  if (!ID_REGEX.test(fileID)) {
    error(404);
  }

  const parsedRequest = await requestSchema.safeParseAsync({
    requiredType: url.searchParams.get("conv"),
  });
  if (!parsedRequest.success) {
    error(400);
  }
  const {
    requiredType,
  } = parsedRequest.data;

  const file = await downloadFile(fileID, determineRequiredType(requiredType));
  if (!file) {
    logger.info(`File "${fileID}" not found for download request from "${getClientAddress()}"`);
    error(404);
  }

  logger.info(`File "${fileID}" downloaded by "${getClientAddress()}"`);

  return new Response(file.content, {
    headers: {
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "Content-Type": file.contentType,
      "Content-Length": file.contentLength.toString(),
      "X-Content-Encryption": file.isEncrypted.toString(),
    }
  });
};