<script lang="ts">
  import "$lib/style.css";
  import { archiveName } from "$lib/archive-name";
  import FolderNameEditor from "$lib/FolderNameEditor.svelte";
  import { SvelteURLSearchParams } from "svelte/reactivity";
  import { onMount, onDestroy } from "svelte";
  import FileSaver from "file-saver";
  import { MAX_CONVERTIBLE_IMAGE_SIZE } from "$lib/constants";
  import {
    decodeStringFromBase64,
    encodeStringInBase64,
    deriveBitsUsingPBKDF2,
    decryptUsingAES256CBC,
  } from "$lib/cipher";
  import { getUploadedFiles } from "$lib/storage";
  import { readStoredZip, createStoredZip } from "$lib/zip";

  let { data } = $props();

  let selected: string[] = $state([]);
  let managementToken = $state("");
  let renamedFolder = $state<{ id: string; name: string } | null>(null);
  const folderName = $derived(
    data.folder
      ? (renamedFolder?.id === data.folder.id ? renamedFolder.name : data.folder.name) ||
          `${data.folder.files.length} files`
      : "Download Folder",
  );
  $effect(() => {
    const id = data.folder?.id;
    managementToken = "";
    if (!id) return;
    try {
      managementToken =
        getUploadedFiles().find((file) => file.kind === "folder" && file.id === id)
          ?.managementToken || "";
    } catch {
      // Shared links remain usable when browser storage is unavailable.
    }
  });

  let passphrase = $state("");
  let origin = $state("");
  let busy = $state(false);
  let status = $state("");
  let statusTone = $state<"progress" | "success" | "error">("progress");
  let copyStatus = $state("");
  let includePassphrase = $state(true);
  let activeFileID: string | null = $state(null);

  const cannotCopy = $derived(!!data.folder?.isEncrypted && includePassphrase && !passphrase);
  const shareURL = (pathname: string) =>
    `${origin}${pathname}${data.folder?.isEncrypted && includePassphrase && passphrase ? `#${encodeStringInBase64(passphrase)}` : ""}`;

  async function copyFolderLink() {
    if (cannotCopy) return;
    try {
      await navigator.clipboard.writeText(shareURL(`/app/folder/${data.folder!.id}`));
      copyStatus = "";
    } catch {
      copyStatus = "Could not copy the link. Please try again.";
    }
  }
  const fileURL = (file: { id: string; name: string }) =>
    data.folder?.isEncrypted
      ? `/app/file/${file.id}`
      : `/${file.id}/${encodeURIComponent(file.name)}`;

  async function copyFileLink(file: { id: string; name: string }) {
    if (cannotCopy) return;
    try {
      await navigator.clipboard.writeText(shareURL(fileURL(file)));
      copyStatus = "";
    } catch {
      copyStatus = "Could not copy the link. Please try again.";
    }
  }

  let encryptedArchive: ArrayBuffer | undefined;
  let encryptedSelection = "";
  const showImageConversion = $derived(
    !!data.folder &&
      !data.folder.isEncrypted &&
      (data.folder.isDisposable
        ? data.folder.files.every((f) => f.contentType.startsWith("image/"))
        : data.folder.files.some((f) => f.contentType.startsWith("image/"))),
  );
  const conversionFiles = $derived(
    data.folder?.files.filter((f) => data.folder!.isDisposable || selected.includes(f.id)) ?? [],
  );
  const conversionReason = $derived.by(() => {
    if (!conversionFiles.length) {
      return "Select at least one image to convert.";
    }
    if (conversionFiles.some((file) => !file.contentType.startsWith("image/"))) {
      return data.folder?.isDisposable
        ? "Conversion is unavailable because Single Download requires all files, including non-image files."
        : "Only images can be converted. Deselect the non-image files to continue.";
    }
    if (conversionFiles.some((file) => file.size > MAX_CONVERTIBLE_IMAGE_SIZE)) {
      return "One or more selected images exceed the conversion size limit.";
    }
    return "";
  });

  const archivePath = (format: "zip" | "tar") =>
    `/${data.folder!.id}/${encodeURIComponent(archiveName(folderName, format))}`;
  const curlCommand = $derived(
    data.folder ? `curl -OJ ${origin}/${data.folder.id}` : "",
  );
  const url = (conversion = "", selection = false) => {
    const query = new SvelteURLSearchParams();
    if (conversion) query.set("conv", conversion);
    if (selection) selected.forEach((id) => query.append("file", id));
    return `${archivePath("zip")}?zip${query.size ? `&${query}` : ""}`;
  };

  onMount(() => {
    origin = window.location.origin;
    if (!data.folder) return;
    selected = data.folder.files.map((f) => f.id);
    try {
      passphrase = window.location.hash
        ? decodeStringFromBase64(window.location.hash.slice(1))
        : getUploadedFiles().find((f) => f.kind === "folder" && f.id === data.folder!.id)
            ?.passphrase || "";
    } catch {
      /* A malformed fragment can be replaced manually. */
    }
  });

  let conversionURL: string | undefined = $state();
  let downloadFrame: HTMLIFrameElement;
  let downloadTimer: ReturnType<typeof setInterval> | undefined;
  let progressCookie = "";
  function clearDownloadSignal() {
    clearInterval(downloadTimer);
    downloadTimer = undefined;
    if (progressCookie && typeof document !== "undefined") {
      document.cookie = `${progressCookie}=; Max-Age=0; Path=/app/folder/${data.folder!.id}; SameSite=Strict`;
    }

    progressCookie = "";
  }

  onDestroy(clearDownloadSignal);
  function finishConversionRequest(started: boolean) {
    clearDownloadSignal();
    busy = false;
    statusTone = started ? "success" : "error";
    status = started
      ? "Download started. Images are converted as the ZIP is streamed. Check your browser's download list for progress."
      : "Could not start the download. The folder may have expired or an image may be unsupported. Please try again.";
  }

  function downloadConverted(type: "jpg" | "png") {
    if (busy || conversionReason) return;
    busy = true;
    statusTone = "progress";
    status = `Preparing your ${type === "jpg" ? "JPEG" : "PNG"} download... Please wait.`;
    clearDownloadSignal();
    const token = crypto.randomUUID();
    progressCookie = `folder-download-${token}`;
    // An attachment navigation lets the browser write the response to disk as
    // it arrives. The short-lived cookie signals headers without buffering a Blob.
    downloadTimer = setInterval(() => {
      const signal = document.cookie
        .split("; ")
        .find((cookie) => cookie.startsWith(`${progressCookie}=`));
      if (signal) finishConversionRequest(signal.slice(progressCookie.length + 1) === "started");
    }, 200);
    conversionURL = `${url(type, !data.folder!.isDisposable)}&downloadToken=${token}`;
  }

  function checkDownloadFrame() {
    // Attachment responses do not load a document; an error response does.
    if (progressCookie && downloadFrame.contentDocument?.body?.textContent?.trim())
      finishConversionRequest(false);
  }

  async function decryptContent(content: ArrayBuffer) {
    if (content.byteLength < 32 || new TextDecoder().decode(content.slice(0, 8)) !== "Salted__")
      throw new Error("Invalid encrypted file");
    const key = await deriveBitsUsingPBKDF2(passphrase, new Uint8Array(content.slice(8, 16)), 384);
    return decryptUsingAES256CBC(content.slice(16), key.slice(0, 32), key.slice(32, 48));
  }

  async function downloadEncryptedFile(file: { id: string; name: string }) {
    if (busy || !passphrase || data.folder!.isDisposable) return;
    busy = true;
    statusTone = "progress";
    activeFileID = file.id;
    try {
      status = `Downloading ${file.name}...`;
      const response = await fetch(`/api/file/${file.id}`);
      if (!response.ok) throw new Error("Download failed");
      const encrypted = await response.arrayBuffer();
      status = `Decrypting ${file.name}...`;
      const decrypted = await decryptContent(encrypted);
      FileSaver.saveAs(new Blob([decrypted]), file.name);
      statusTone = "success";
      status = "Succeeded in decrypting the file!";
    } catch {
      statusTone = "error";
      status = "Could not download or decrypt the file. Check your passphrase and try again.";
    } finally {
      activeFileID = null;
      busy = false;
    }
  }
  async function downloadEncrypted(selection = false) {
    if (!passphrase || busy) return;
    busy = true;
    statusTone = "progress";
    try {
      const target = url("", selection);
      if (!encryptedArchive || encryptedSelection !== target) {
        status = "Downloading encrypted files...";
        const response = await fetch(target);
        if (!response.ok) throw new Error("Download failed. The folder may have expired.");
        encryptedArchive = await response.arrayBuffer();
        encryptedSelection = target;
      }

      status = "Decrypting files...";
      const files = readStoredZip(encryptedArchive);
      const decrypted = [];
      for (const file of files) {
        const content = await decryptContent(file.content);
        decrypted.push({ name: file.name, content });
      }

      FileSaver.saveAs(
        createStoredZip(decrypted, data.folder!.uploadedAt),
        archiveName(folderName, "zip"),
      );
      statusTone = "success";
      status = "Succeeded in decrypting the files!";
    } catch {
      statusTone = "error";
      status = "Could not download or decrypt the files. Check your passphrase and try again.";
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head><title>{folderName} - Minchan's Upload</title></svelte:head>
<iframe
  hidden
  title="Converted file download"
  bind:this={downloadFrame}
  src={conversionURL}
  onload={checkDownloadFrame}
></iframe>
<main class="main">
  <section class="download-section">
    <div class="section-header">
      <h2 class="section-title"><span class="section-icon">📁</span> Download Folder</h2>
    </div>
    {#if !data.folder}
      <div class="error-card rounded-box">
        <div class="error-icon">❌</div>
        <div class="error-content">
          <h3>Folder Not Found</h3>
          <p>This folder has expired or is no longer available.</p>
        </div>
      </div>
    {:else}
      <div class="file-info-card rounded-box">
        <span class="file-icon">📁</span>
        <div class="file-details">
          {#key data.folder.id}
            <FolderNameEditor
              variant="folder"
              id={data.folder.id}
              name={folderName}
              fileCount={data.folder.files.length}
              isEncrypted={data.folder.isEncrypted}
              {managementToken}
              onsave={(name) => {
                renamedFolder = { id: data.folder!.id, name };
              }}
            />
          {/key}
        </div>
      </div>
      <div class="download-section-card rounded-box">
        <div class="download-header">
          <h3>
            <span class="download-icon" aria-hidden="true">📥</span><span>Download Files</span>
          </h3>
          <p class="download-description">
            {data.folder.isDisposable
              ? "Single Download: download all files together once. The entire folder will then be deleted."
              : "Download all files, choose individual files, or select a group."}
          </p>
        </div>
        <div class="download-form">
          {#if data.folder.isEncrypted}
            <label class="passphrase-label"
              ><span class="label-text">Encryption Passphrase</span><input
                class="passphrase-input"
                type="password"
                bind:value={passphrase}
                disabled={busy}
                autocomplete="off"
                placeholder="Enter the passphrase..."
              /></label
            >
          {/if}
          <div class="download-actions">
            <button class="copy-button" disabled={cannotCopy} onclick={copyFolderLink}
              ><span aria-hidden="true">📋</span><span>Copy Link</span></button
            >
            {#if data.folder.isEncrypted}<button
                class="download-button"
                disabled={busy || !passphrase}
                onclick={() => downloadEncrypted()}
                ><span class="button-icon" aria-hidden="true">🔓</span><span
                  >Decrypt &amp; Download <span class="keep-together">All (ZIP)</span></span
                ></button
              >
            {:else}<a
                class="direct-download-button"
                href={busy ? undefined : url()}
                aria-disabled={busy}
                onclick={(event) => {
                  if (busy) event.preventDefault();
                }}
                download
                ><span aria-hidden="true">📥</span><span
                  >Download <span class="keep-together">All (ZIP)</span></span
                ></a
              >{/if}
          </div>
          {#if data.folder.isEncrypted}
            <label class="share-option">
              <input type="checkbox" bind:checked={includePassphrase} />
              <span>Include passphrase in copied URLs</span>
            </label>
          {/if}
          {#if status}<p class="status-indicator {statusTone}" role="status">
              {status}
            </p>{/if}
          <div class="file-list">
            {#if !data.folder.isDisposable}<label class="select-all"
                ><input
                  type="checkbox"
                  checked={selected.length === data.folder.files.length}
                  disabled={busy}
                  onchange={(event) =>
                    (selected = event.currentTarget.checked
                      ? data.folder!.files.map((f) => f.id)
                      : [])}
                />Select all</label
              >{/if}
            {#each data.folder.files as file (file.id)}
              <div class="file-row">
                <label class="file-choice"
                  >{#if !data.folder.isDisposable}<input
                      type="checkbox"
                      bind:group={selected}
                      value={file.id}
                      disabled={busy}
                    />{/if}<span class="file-summary"
                    ><span>{file.name}</span><span class="file-id">ID: {file.id}</span></span
                  ></label
                >
                {#if !data.folder.isDisposable}
                  <div class="file-actions">
                    {#if data.folder.isEncrypted}
                      <button
                        class="individual-link"
                        disabled={busy || !passphrase}
                        onclick={() => downloadEncryptedFile(file)}
                      >
                        {activeFileID === file.id ? "Working..." : "Decrypt & Download"}
                      </button>
                    {:else}
                      <a class="individual-link" href={fileURL(file)}>Download</a>
                    {/if}
                    <button
                      class="file-copy-button"
                      disabled={cannotCopy}
                      onclick={() => copyFileLink(file)}
                      aria-label={`Copy ${data.folder.isEncrypted ? "decryption" : "download"} link for ${file.name}`}
                      title={data.folder.isEncrypted
                        ? "Copy decryption page link"
                        : "Copy download link"}>📋</button
                    >
                  </div>
                {/if}
              </div>
            {/each}
          </div>
          {#if copyStatus}<p class="copy-status" role="status">{copyStatus}</p>{/if}
          {#if !data.folder.isDisposable}
            {#if data.folder.isEncrypted}<button
                class="download-button"
                disabled={busy || !passphrase || !selected.length}
                onclick={() => downloadEncrypted(true)}
                ><span class="button-icon" aria-hidden="true">🔓</span><span
                  >Decrypt &amp; Download <span class="keep-together"
                    >Selected ({selected.length})</span
                  ></span
                ></button
              >
            {:else}<button
                class="download-button"
                disabled={busy || !selected.length}
                onclick={() => window.location.assign(url("", true))}
                ><span class="button-icon" aria-hidden="true">📥</span><span
                  >Download <span class="keep-together">Selected ({selected.length})</span></span
                ></button
              >{/if}
          {/if}
          {#if showImageConversion}
            <div class="conversion-options" class:unavailable={!!conversionReason}>
              <h4>Image Conversion</h4>
              <div class="conversion-buttons">
                <button
                  class="conversion-button"
                  disabled={busy || !!conversionReason}
                  onclick={() => downloadConverted("jpg")}
                  ><span aria-hidden="true">🖼️</span><span
                    >Convert {data.folder.isDisposable ? "All" : "Selected"} to
                    <span class="keep-together">JPEG</span></span
                  ></button
                ><button
                  class="conversion-button"
                  disabled={busy || !!conversionReason}
                  onclick={() => downloadConverted("png")}
                  ><span aria-hidden="true">🖼️</span><span
                    >Convert {data.folder.isDisposable ? "All" : "Selected"} to
                    <span class="keep-together">PNG</span></span
                  ></button
                >
              </div>
              {#if conversionReason}<p class="conversion-reason" role="status">
                  {conversionReason}
                </p>{/if}
            </div>
          {/if}
          {#if !data.folder.isEncrypted}
            <div class="curl-inline">
              <span class="curl-label">Or use command line:</span>
              <div class="curl-container">
                <code class="curl-command-inline">{curlCommand}</code><button
                  class="curl-copy-btn"
                  aria-label="Copy curl command"
                  onclick={() => navigator.clipboard.writeText(curlCommand)}>📋</button
                >
              </div>
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </section>
  {#if data.folder}<section class="info-section">
      <div class="info-card rounded-box">
        <h3><span class="info-icon">🔒</span>Privacy Policy</h3>
        <p>
          When downloading files, we <strong>permanently</strong> store: folder ID, file IDs and your
          IP address.
        </p>
      </div>
    </section>{/if}
</main>

<style>
  .main {
    display: flex;
    flex-direction: column;
    gap: 32px;
  }

  .download-section {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .section-header {
    text-align: center;
    margin-bottom: 16px;
  }

  .section-title {
    margin: 0;
    font-size: 32px;
    font-weight: 700;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
  }

  .section-icon {
    font-size: 36px;
  }

  .error-card {
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 32px;
    background: rgba(254, 242, 242, 0.9);
    border: 2px solid rgba(239, 68, 68, 0.2);
    backdrop-filter: blur(10px);
  }

  .error-icon {
    font-size: 48px;
    flex-shrink: 0;
    color: #dc2626;
  }

  .error-content h3 {
    margin: 0 0 8px 0;
    color: #991b1b;
    font-size: 24px;
    font-weight: 700;
  }

  .error-content p {
    margin: 0;
    color: #7c2d12;
    font-size: 16px;
    line-height: 1.5;
    font-weight: 500;
  }

  .file-info-card {
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 24px;
  }

  .file-icon {
    font-size: 48px;
    flex-shrink: 0;
    opacity: 0.8;
  }

  .file-details {
    flex: 1;
    min-width: 0;
  }

  .passphrase-label {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .label-text {
    font-weight: 600;
    color: #333;
    font-size: 16px;
  }

  .passphrase-input {
    width: 100%;
    padding: 16px;
    border: 2px solid rgba(102, 126, 234, 0.2);
    border-radius: 12px;
    font-size: 16px;
    background: rgba(255, 255, 255, 0.9);
    transition: all 0.3s ease;
  }

  .passphrase-input:focus {
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    outline: none;
  }

  .download-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 4px 16px rgba(102, 126, 234, 0.3);
  }

  .download-button:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 24px rgba(102, 126, 234, 0.4);
  }

  .download-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  .direct-download-button[aria-disabled="true"] {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .status-indicator.progress {
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid rgba(59, 130, 246, 0.2);
    color: #3b82f6;
  }

  .status-indicator.success {
    background: rgba(34, 197, 94, 0.1);
    border: 1px solid rgba(34, 197, 94, 0.2);
    color: #22c55e;
  }

  .status-indicator.error {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }

  .status-indicator {
    margin: 0;
    overflow-wrap: anywhere;
    padding: 12px 16px;
    border-radius: 8px;
    font-weight: 500;
    text-align: center;
  }

  .download-section-card {
    padding: 32px;
  }

  .download-header {
    text-align: center;
    margin-bottom: 24px;
  }

  .download-header h3 {
    margin: 0 0 12px 0;
    font-size: 24px;
    font-weight: 600;
    color: #333;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .download-description {
    margin: 0;
    color: #666;
    font-size: 16px;
    line-height: 1.5;
  }

  .download-form {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .download-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .download-actions .download-button {
    min-width: 0;
    padding: 12px 20px;
    font-size: 14px;
    gap: 8px;
  }

  .download-actions .button-icon {
    font-size: inherit;
  }

  .button-icon {
    flex-shrink: 0;
    font-size: 16px;
    line-height: 1;
  }

  .download-icon {
    font-size: 28px;
  }

  .keep-together {
    white-space: nowrap;
  }

  .copy-button,
  .direct-download-button {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 20px;
    border: none;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    text-decoration: none;
    transition: all 0.3s ease;
    flex: 1;
    justify-content: center;
    min-width: 140px;
  }

  .copy-button {
    background: #667eea;
    color: white;
  }

  .direct-download-button {
    background: #22c55e;
    color: white;
  }

  .copy-button:hover,
  .direct-download-button:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }

  .conversion-options {
    padding: 20px;
    background: rgba(102, 126, 234, 0.05);
    border: 1px solid rgba(102, 126, 234, 0.15);
    border-radius: 12px;
  }

  .conversion-options h4 {
    margin: 0 0 12px 0;
    font-size: 16px;
    font-weight: 600;
    color: #333;
  }

  .conversion-options.unavailable {
    background: rgba(113, 128, 150, 0.06);
  }

  .conversion-reason {
    margin: 12px 0 0;
    font-size: 14px;
    color: #666;
    line-height: 1.5;
  }

  .conversion-buttons {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .conversion-button {
    box-shadow: none;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: rgba(102, 126, 234, 0.1);
    color: #667eea;
    text-decoration: none;
    border: 1px solid rgba(102, 126, 234, 0.2);
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.3s ease;
    flex: 1;
    justify-content: center;
    min-width: 120px;
  }

  .conversion-button:hover:not(:disabled) {
    box-shadow: none;
    background: #667eea;
    color: white;
    transform: translateY(-1px);
  }

  .curl-inline {
    margin-top: 24px;
    margin-bottom: 0;
    padding: 12px;
    background: rgba(102, 126, 234, 0.05);
    border: 1px solid rgba(102, 126, 234, 0.15);
    border-radius: 8px;
  }

  .curl-label {
    display: block;
    font-size: 13px;
    color: #666;
    margin-bottom: 8px;
    font-weight: 500;
  }

  .curl-container {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .curl-command-inline {
    flex: 1;
    display: block;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 8px 12px;
    font-family: "SF Mono", "Monaco", "Inconsolata", "Roboto Mono", monospace;
    font-size: 12px;
    line-height: 1.4;
    overflow-x: auto;
    white-space: nowrap;
    color: #374151;
  }

  .curl-copy-btn {
    flex-shrink: 0;
    padding: 8px 10px;
    background: #667eea;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .curl-copy-btn:hover {
    background: #5a67d8;
    transform: translateY(-1px);
  }

  .info-section {
    margin-top: 24px;
  }

  .info-card {
    text-align: center;
    padding: 24px;
  }

  .info-card h3 {
    margin: 0 0 12px 0;
    color: #333;
    font-size: 18px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .info-icon {
    font-size: 24px;
  }

  .info-card p {
    margin: 0;
    color: #666;
    line-height: 1.6;
  }

  @media (max-width: 768px) {
    .main {
      gap: 32px;
    }

    .section-header {
      margin-bottom: 0;
    }

    .section-title {
      font-size: 28px;
      flex-direction: column;
      gap: 8px;
    }

    .file-details {
      width: 100%;
    }

    .file-info-card {
      flex-direction: column;
      text-align: center;
      gap: 16px;
    }

    .download-section-card {
      padding: 24px;
    }

    .download-header h3 {
      font-size: 20px;
      flex-direction: column;
      gap: 4px;
    }

    .download-actions {
      grid-template-columns: minmax(0, 1fr);
    }

    .copy-button,
    .direct-download-button {
      min-width: unset;
    }

    .curl-inline {
      display: none;
    }

    .conversion-buttons {
      flex-direction: column;
    }

    .conversion-button {
      min-width: unset;
    }
  }

  @media (max-width: 480px) {
    .section-title {
      font-size: 24px;
    }

    .error-card {
      flex-direction: column;
      text-align: center;
      padding: 24px;
    }

    .download-button {
      padding: 12px 16px;
    }
  }
  .file-list {
    border: 1px solid var(--border-color);
    border-radius: 12px;
    overflow: hidden;
  }

  .file-row,
  .select-all {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
  }

  .file-row + .file-row {
    border-top: 1px solid var(--border-color);
  }

  .select-all {
    background: var(--primary-color-light);
    font-weight: 600;
  }

  .file-choice {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .file-choice input {
    flex-shrink: 0;
    margin: 3px 0 0;
  }

  .select-all input {
    flex-shrink: 0;
    margin: 0;
  }

  .file-choice,
  .select-all {
    cursor: pointer;
  }

  .file-summary > span:first-child {
    line-height: 1.5;
  }

  .file-summary {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    min-width: 0;
  }

  .file-id {
    font-family: "SF Mono", "Monaco", "Inconsolata", "Roboto Mono", monospace;
    font-size: 0.7rem;
    color: #4a5568;
    background: #f7fafc;
    padding: 0.3rem 0.6rem;
    border-radius: 6px;
    border: 1px solid #e2e8f0;
  }

  .file-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
    flex-wrap: wrap;
  }

  .individual-link,
  .file-copy-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 40px;
    line-height: 20px;
    text-decoration: none;
    padding: 8px 12px;
    border: 1px solid rgba(102, 126, 234, 0.2);
    border-radius: 8px;
    background: rgba(102, 126, 234, 0.1);
    color: var(--primary-color);
    font-size: 14px;
    font-weight: 500;
    box-shadow: none;
  }

  .individual-link:hover,
  .file-copy-button:hover {
    background: rgba(102, 126, 234, 0.2);
    transform: none;
  }

  .file-copy-button {
    width: 40px;
    padding: 8px;
    flex-shrink: 0;
  }

  .share-option {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 16px;
    background: rgba(59, 130, 246, 0.05);
    border: 1px solid rgba(59, 130, 246, 0.1);
    border-radius: 8px;
    cursor: pointer;
    color: #333;
    font-size: 14px;
  }

  .share-option input {
    margin: 0;
    flex-shrink: 0;
  }

  .individual-link:disabled,
  .file-copy-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }

  .copy-status {
    margin: 0;
    color: #666;
    font-size: 14px;
    overflow-wrap: anywhere;
  }

  @media (max-width: 480px) {
    .file-row {
      flex-wrap: wrap;
    }

    .file-choice {
      flex-basis: 100%;
    }

    .file-actions {
      width: 100%;
      justify-content: flex-end;
      align-items: stretch;
      flex-wrap: nowrap;
    }

    .file-actions .individual-link {
      flex: 1;
      min-width: 0;
      text-align: center;
    }

    .file-copy-button {
      flex-shrink: 0;
    }
  }
  .individual-link {
    flex-shrink: 0;
    font-size: 14px;
  }

  .download-button {
    text-decoration: none;
  }
</style>
