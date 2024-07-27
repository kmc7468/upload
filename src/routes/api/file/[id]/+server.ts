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