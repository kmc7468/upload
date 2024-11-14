import { error } from "@sveltejs/kit";
import { ID_REGEX } from "$lib/server/loadenv";
import { fileDownloadHandler } from "$lib/server/services/files";
import type { RequestHandler } from "./$types";

const determineRequiredType = (requiredType: string | null) => {
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

  const file = await fileDownloadHandler({
    fileID,
    requiredType: determineRequiredType(url.searchParams.get("conv")),

    clientAddress: getClientAddress(),
  });

  return new Response(file.content, {
    headers: {
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "Content-Type": file.contentType,
      "Content-Length": file.contentLength.toString(),
      "X-Content-Encryption": file.isEncrypted.toString(),
    }
  });
};