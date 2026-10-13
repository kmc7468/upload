<script lang="ts">
  import { archiveName } from "$lib/archive-name";
  import FolderNameEditor from "$lib/components/FolderNameEditor.svelte";
  import { SvelteURLSearchParams } from "svelte/reactivity";
  import { onMount, onDestroy } from "svelte";
  import { page } from "$app/state";
  import FileSaver from "file-saver";
  import { MAX_CONVERTIBLE_IMAGE_SIZE } from "$lib/constants";
  import Download from "phosphor-svelte/lib/DownloadSimpleIcon";
  import Image from "phosphor-svelte/lib/ImageIcon";
  import LockOpen from "phosphor-svelte/lib/LockOpenIcon";
  import ShieldCheck from "phosphor-svelte/lib/ShieldCheckIcon";
  import { decryptOpenSSL } from "$lib/cipher";
  import Button from "$lib/components/Button.svelte";
  import Card from "$lib/components/Card.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import CommandLine from "$lib/components/CommandLine.svelte";
  import CopyButton from "$lib/components/CopyButton.svelte";
  import StatusMessage from "$lib/components/StatusMessage.svelte";
  import {
    downloadPath,
    fileSharePath,
    folderPagePath,
    passphraseFromHash,
    withPassphrase,
  } from "$lib/urls";
  import { shellQuote } from "$lib/shell";
  import { getUploadedFiles } from "$lib/storage";
  import { clock } from "$lib/clock.svelte";
  import PasswordInput from "$lib/components/PasswordInput.svelte";
  import { formatDateTime, formatExpiry, formatSize } from "$lib/utils";
  import { readStoredZip, createStoredZip } from "$lib/zip";

  let { data } = $props();

  // Every file starts selected, already in the page the server sends, and again whenever
  // another folder opens.
  let selected = $derived(data.folder.files.map((f) => f.id));
  let managementToken = $state("");
  let renamedFolder = $state<{ id: string; name: string } | null>(null);
  const folderName = $derived(
    (renamedFolder?.id === data.folder.id ? renamedFolder.name : data.folder.name) ||
      `${data.folder.files.length} files`,
  );
  $effect(() => {
    const id = data.folder.id;
    managementToken = "";
    try {
      managementToken =
        getUploadedFiles().find((file) => file.kind === "folder" && file.id === id)
          ?.managementToken || "";
    } catch {
      // Shared links remain usable when browser storage is unavailable.
    }
  });

  let passphrase = $state("");
  let busy = $state(false);
  let status = $state("");
  let statusTone = $state<"progress" | "success" | "error">("progress");
  let includePassphrase = $state(true);
  let activeFileID: string | null = $state(null);

  const cannotCopy = $derived(data.folder.isEncrypted && includePassphrase && !passphrase);
  const shareURL = (pathname: string) =>
    data.folder.isEncrypted && includePassphrase && passphrase
      ? withPassphrase(`${page.url.origin}${pathname}`, passphrase)
      : `${page.url.origin}${pathname}`;

  const fileURL = (file: { id: string; name: string }) =>
    fileSharePath({ ...file, isEncrypted: data.folder.isEncrypted });

  let encryptedArchive: ArrayBuffer | undefined;
  let encryptedSelection = "";
  const showImageConversion = $derived(
    !data.folder.isEncrypted &&
      (data.folder.isDisposable
        ? data.folder.files.every((f) => f.contentType.startsWith("image/"))
        : data.folder.files.some((f) => f.contentType.startsWith("image/"))),
  );
  const conversionFiles = $derived(
    data.folder.files.filter((f) => data.folder.isDisposable || selected.includes(f.id)),
  );
  const conversionReason = $derived.by(() => {
    if (!conversionFiles.length) {
      return "Select at least one image to convert.";
    }
    if (conversionFiles.some((file) => !file.contentType.startsWith("image/"))) {
      return data.folder.isDisposable
        ? "Conversion is unavailable because Single Download requires all files, including non-image files."
        : "Only images can be converted. Deselect the non-image files to continue.";
    }
    if (conversionFiles.some((file) => file.size > MAX_CONVERTIBLE_IMAGE_SIZE)) {
      return "One or more selected images exceed the conversion size limit.";
    }
    return "";
  });

  const archivePath = (format: "zip" | "tar") =>
    downloadPath(data.folder.id, archiveName(folderName, format));
  const curlCommand = $derived(`curl -OJ ${shellQuote(`${page.url.origin}/${data.folder.id}`)}`);
  const url = (conversion = "", selection = false) => {
    const query = new SvelteURLSearchParams();
    if (conversion) query.set("conv", conversion);
    if (selection) selected.forEach((id) => query.append("file", id));
    return `${archivePath("zip")}?zip${query.size ? `&${query}` : ""}`;
  };

  onMount(() => {
    try {
      passphrase = window.location.hash
        ? passphraseFromHash(window.location.hash)
        : getUploadedFiles().find((f) => f.kind === "folder" && f.id === data.folder.id)
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
      document.cookie = `${progressCookie}=; Max-Age=0; Path=${folderPagePath(data.folder.id)}; SameSite=Strict`;
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
    conversionURL = `${url(type, !data.folder.isDisposable)}&downloadToken=${token}`;
  }

  function checkDownloadFrame() {
    // Attachment responses do not load a document; an error response does.
    if (progressCookie && downloadFrame.contentDocument?.body?.textContent?.trim())
      finishConversionRequest(false);
  }

  async function downloadEncryptedFile(file: { id: string; name: string }) {
    if (busy || !passphrase || data.folder.isDisposable) return;
    busy = true;
    statusTone = "progress";
    activeFileID = file.id;
    try {
      status = `Downloading ${file.name}...`;
      const response = await fetch(`/api/file/${file.id}`);
      if (!response.ok) throw new Error("Download failed");
      const encrypted = await response.arrayBuffer();
      status = `Decrypting ${file.name}...`;
      const decrypted = await decryptOpenSSL(encrypted, passphrase);
      FileSaver.saveAs(new Blob([decrypted]), file.name);
      statusTone = "success";
      status = "The file has been decrypted.";
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
        const content = await decryptOpenSSL(file.content, passphrase);
        decrypted.push({ name: file.name, content });
      }

      FileSaver.saveAs(
        createStoredZip(decrypted, data.folder.uploadedAt),
        archiveName(folderName, "zip"),
      );
      statusTone = "success";
      status = "The files have been decrypted.";
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
<div class="page">
  <PageHeader title="Download Folder" />
  <section class="card">
    {#key data.folder.id}
      <FolderNameEditor
        variant="folder"
        id={data.folder.id}
        name={folderName}
        fileCount={data.folder.files.length}
        isEncrypted={data.folder.isEncrypted}
        details={[
          { text: formatSize(data.folder.files.reduce((sum, file) => sum + file.size, 0)) },
          {
            text: formatExpiry(data.folder.expireAt, clock.now),
            title: formatDateTime(data.folder.expireAt),
          },
        ]}
        {managementToken}
        onsave={(name) => {
          renamedFolder = { id: data.folder.id, name };
        }}
      />
    {/key}
  </section>
  <Card
    icon={Download}
    title="Download Files"
    description={data.folder.isDisposable
      ? "Single Download: download all files together once. The entire folder will then be deleted."
      : "Download all files, choose individual files, or select a group."}
  >
    <div class="download-form">
      {#if data.folder.isEncrypted}
        <div>
          <label class="field-label" for="passphrase">Passphrase</label>
          <PasswordInput
            id="passphrase"
            bind:value={passphrase}
            disabled={busy}
            placeholder="Enter the passphrase"
          />
        </div>
      {/if}
      <div class="download-actions">
        <CopyButton text={() => shareURL(folderPagePath(data.folder.id))} disabled={cannotCopy} />
        {#if data.folder.isEncrypted}
          <Button
            variant="primary"
            icon={LockOpen}
            disabled={busy || !passphrase}
            onclick={() => downloadEncrypted()}
          >
            <span>Decrypt &amp; Download <span class="keep-together">All (ZIP)</span></span>
          </Button>
        {:else}
          <Button variant="primary" icon={Download} href={url()} disabled={busy} download>
            <span>Download <span class="keep-together">All (ZIP)</span></span>
          </Button>
        {/if}
      </div>
      {#if data.folder.isEncrypted}
        <label class="checkbox-label">
          <input type="checkbox" bind:checked={includePassphrase} />
          <span>Include passphrase in copied URLs</span>
        </label>
      {/if}
      {#if status}
        <StatusMessage tone={statusTone}>{status}</StatusMessage>
      {/if}
      <div class="file-list">
        {#if !data.folder.isDisposable}
          <label class="select-all">
            <input
              type="checkbox"
              checked={selected.length === data.folder.files.length}
              disabled={busy}
              onchange={(event) =>
                (selected = event.currentTarget.checked ? data.folder.files.map((f) => f.id) : [])}
            />
            Select All
          </label>
        {/if}
        {#each data.folder.files as file (file.id)}
          <div class="file-row" data-id={file.id}>
            <label class="file-choice">
              {#if !data.folder.isDisposable}
                <input type="checkbox" bind:group={selected} value={file.id} disabled={busy} />
              {/if}
              <span class="file-summary">
                <span>{file.name}</span>
                <span class="file-size">{formatSize(file.size)}</span>
              </span>
            </label>
            {#if !data.folder.isDisposable}
              <div class="file-actions">
                {#if data.folder.isEncrypted}
                  <Button
                    size="sm"
                    icon={LockOpen}
                    disabled={busy || !passphrase}
                    onclick={() => downloadEncryptedFile(file)}
                  >
                    {activeFileID === file.id ? "Working..." : "Decrypt & Download"}
                  </Button>
                {:else}
                  <Button size="sm" icon={Download} href={fileURL(file)}>Download</Button>
                {/if}
                <CopyButton
                  text={() => shareURL(fileURL(file))}
                  variant="ghost"
                  size="sm"
                  iconOnly
                  disabled={cannotCopy}
                  label={data.folder.isEncrypted
                    ? "Copy Decryption Page Link"
                    : "Copy Download Link"}
                />
              </div>
            {/if}
          </div>
        {/each}
      </div>
      {#if !data.folder.isDisposable}
        {#if data.folder.isEncrypted}
          <Button
            block
            icon={LockOpen}
            disabled={busy || !passphrase || !selected.length}
            onclick={() => downloadEncrypted(true)}
          >
            <span>
              Decrypt &amp; Download
              <span class="keep-together">Selected ({selected.length})</span>
            </span>
          </Button>
        {:else}
          <Button
            block
            icon={Download}
            disabled={busy || !selected.length}
            onclick={() => window.location.assign(url("", true))}
          >
            <span>Download <span class="keep-together">Selected ({selected.length})</span></span>
          </Button>
        {/if}
      {/if}
    </div>
    {#if showImageConversion}
      <div class="card-section">
        <h4 class="section-label">Image Conversion</h4>
        <div class="conversion-buttons">
          <Button
            icon={Image}
            disabled={busy || !!conversionReason}
            onclick={() => downloadConverted("jpg")}
          >
            <span>
              Convert {data.folder.isDisposable ? "All" : "Selected"} to
              <span class="keep-together">JPEG</span>
            </span>
          </Button>
          <Button
            icon={Image}
            disabled={busy || !!conversionReason}
            onclick={() => downloadConverted("png")}
          >
            <span>
              Convert {data.folder.isDisposable ? "All" : "Selected"} to
              <span class="keep-together">PNG</span>
            </span>
          </Button>
        </div>
        {#if conversionReason}
          <p class="conversion-reason">{conversionReason}</p>
        {/if}
      </div>
    {/if}
  </Card>

  {#if !data.folder.isEncrypted}
    <CommandLine command={curlCommand} />
  {/if}
  <section class="info-section">
    <div>
      <h3><ShieldCheck />Privacy Policy</h3>
      <p>
        When downloading files, we <strong>permanently</strong> store: folder ID, file IDs and your IP
        address.
      </p>
    </div>
  </section>
</div>

<style>
  .keep-together {
    white-space: nowrap;
  }

  .conversion-reason {
    margin: 10px 0 0;
    font-size: var(--text-sm);
    line-height: 1.6;
    color: var(--color-text-muted);
  }

  .file-list {
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .file-row,
  .select-all {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
  }

  .file-row {
    min-height: 56px;
  }

  .file-row + .file-row,
  .select-all + .file-row {
    border-top: 1px solid var(--color-border);
  }

  .select-all {
    background: var(--color-surface-inset);
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--color-text-secondary);
  }

  .file-choice {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  /* Centers the checkbox on the first line of the name. */
  .file-choice input {
    margin-top: calc((1.5em - 16px) / 2);
  }

  .file-choice,
  .select-all {
    cursor: pointer;
  }

  .file-summary {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    min-width: 0;
    font-size: var(--text-md);
    font-weight: 500;
    line-height: 1.5;
  }

  .file-size {
    font-size: var(--text-sm);
    font-weight: 400;
    color: var(--color-text-muted);
    font-variant-numeric: tabular-nums;
  }

  .file-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
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
      padding-left: 28px;
    }

    .file-actions > :global(.button:first-child) {
      flex: 1;
    }
  }
</style>
