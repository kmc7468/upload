
import { error, text } from "@sveltejs/kit";
import { ID_CHARS, ID_LENGTH } from "$lib/server/loadenv";
import type { RequestHandler } from "./$types";

const idRegex = new RegExp(`^[${ID_CHARS}]{${ID_LENGTH}}$`);

export const GET: RequestHandler = async ({ params, url, fetch }) => {
  const fileID = params.a;
  const fileName = params.b;
  if (!idRegex.test(fileID)) {
    error(404);
  }

  const requiredType = (() => {
    if (url.searchParams.has("jpeg") || url.searchParams.has("jpg")) {
      return "jpeg";
    } else if (url.searchParams.has("png")) {
      return "png";
    } else {
      return undefined;
    }
  })();

  const response = await fetch(`/api/file/${fileID}?` + new URLSearchParams({
    conv: requiredType || "",
  }).toString());
  if (!response.ok) {
    error(response.status);
  }

  const formData = await response.formData();
  const file = formData.get("file") as File;
  return new Response(file, {
    headers: {
      "Content-Disposition": (fileName ? `attachment; filename="${encodeURI(fileName)}"` : "inline"),
      "Content-Length": file.size.toString(),
      "Content-Type": "", // Let the browser infer it
    }
  });
};

const isValidFileAttr = (fileAttr: string) => {
  return fileAttr.split("").every(char => "de".includes(char));
};

export const POST: RequestHandler = async ({ request, params, url, fetch }) => {
  const fileAttr = params.b ? params.a : undefined;
  if (fileAttr && !isValidFileAttr(fileAttr)) {
    error(404);
  }
  const isDisposable = fileAttr?.includes("d") ?? false;
  const isEncrypted = fileAttr?.includes("e") ?? false;

  const fileName = params.b ? params.b : params.a;

  const formData = new FormData();
  formData.append("options", JSON.stringify({
    name: fileName,
    contentType: request.headers.get("Content-Type"),

    isDisposable,
    isEncrypted,
  }));
  formData.append("file", await request.blob());

  const response = await fetch("/api/file/upload", {
    method: "POST",
    body: formData,
  });
  if (!response.ok) {
    error(response.status);
  }

  const fileID = await response.text();
  return text(
    `${url.origin}/${fileID}/${encodeURI(fileName)}\n`,
    { headers: { "Content-Type": "text/plain" } });
};

export const PUT = POST;