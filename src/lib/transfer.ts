// Bytes per second since the previous call.
export const throughputMeter = () => {
  let time = Date.now();
  let loaded = 0;
  return (nowLoaded: number) => {
    const now = Date.now();
    const throughput = ((nowLoaded - loaded) / Math.max(1, now - time)) * 1000;
    time = now;
    loaded = nowLoaded;
    return throughput;
  };
};

interface TransferOptions {
  headers?: Record<string, string>;
  body?: XMLHttpRequestBodyInit;
  responseType?: XMLHttpRequestResponseType;
  // Upload progress for requests with a body, download progress otherwise.
  onProgress?: (loaded: number, total: number) => void;
}

// fetch cannot report upload progress, so transfers with a progress bar use XHR.
// Resolves with the finished request whatever its status.
export const transfer = (method: string, url: string, options: TransferOptions = {}) =>
  new Promise<XMLHttpRequest>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    if (options.responseType) {
      xhr.responseType = options.responseType;
    }
    for (const [name, value] of Object.entries(options.headers ?? {})) {
      xhr.setRequestHeader(name, value);
    }

    (options.body === undefined ? xhr : xhr.upload).addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        options.onProgress?.(event.loaded, event.total);
      }
    });
    xhr.addEventListener("load", () => resolve(xhr));
    xhr.addEventListener("error", () => reject(new Error("The request failed.")));
    xhr.addEventListener("abort", () => reject(new Error("The request was cancelled.")));
    xhr.send(options.body ?? null);
  });

// API routes answer with JSON and the curl routes with plain text. Bare status codes
// such as "Error: 404" carry no explanation, so callers fall back to their own text.
const messageFrom = (contentType: string | null, body: string) => {
  if (contentType?.includes("application/json")) {
    try {
      const { message } = JSON.parse(body);
      return typeof message === "string" && !/^Error: \d+$/.test(message) ? message : undefined;
    } catch {
      return undefined;
    }
  }
  return contentType?.startsWith("text/plain") ? body.trim() || undefined : undefined;
};

export const responseMessage = async (response: Response) =>
  messageFrom(response.headers.get("Content-Type"), await response.text().catch(() => ""));

export const requestMessage = (xhr: XMLHttpRequest) =>
  messageFrom(
    xhr.getResponseHeader("Content-Type"),
    typeof xhr.response === "string" ? xhr.response : "",
  );
