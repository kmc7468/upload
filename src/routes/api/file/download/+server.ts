import { error } from "@sveltejs/kit";
import z from "zod";
import { downloadFile } from "$lib/server/filesystem";
import { ID_CHARS, ID_LENGTH } from "$lib/server/loadenv";
import logger from "$lib/server/logger";
import type { RequestHandler } from "./$types";

const idRegex = new RegExp(`^[${ID_CHARS}]{${ID_LENGTH}}$`);

const requestSchema = z.object({
  fileID: z.string().regex(idRegex),
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

export const GET: RequestHandler = async ({ url, getClientAddress }) => {
  const parsedRequest = await requestSchema.safeParseAsync({
    fileID: url.searchParams.get("id"),
    requiredType: url.searchParams.get("conv"),
  });
  if (!parsedRequest.success) {
    error(400);
  }
  const {
    fileID,
    requiredType,
  } = parsedRequest.data;

  const file = await downloadFile(fileID, determineRequiredType(requiredType));

  logger.info(`File "${fileID}" downloaded by "${getClientAddress()}"`);

  const formData = new FormData();
  formData.append("options", JSON.stringify({
    name: file.name,
    contentType: file.contentType,
    isEncrypted: file.isEncrypted,
  }));
  formData.append("file", new Blob([file.content]), file.name);

  return new Response(formData);
};