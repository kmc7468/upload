<script lang="ts">
  import { type Writable } from "svelte/store";
  import { encryptOpenSSL } from "$lib/cipher";
  import { MAX_FILE_SIZE, MAX_CONVERTIBLE_IMAGE_SIZE } from "$lib/constants";
  import { addUploadedFile } from "$lib/storage";
  import { collectDroppedFiles } from "$lib/dropped-files";
  import { requestMessage, responseMessage, throughputMeter, transfer } from "$lib/transfer";
  import { fileSharePath } from "$lib/urls";
  import { formatSize } from "$lib/utils";
  import CloudUpload from "phosphor-svelte/lib/CloudArrowUpIcon";
  import KeyRound from "phosphor-svelte/lib/KeyIcon";
  import LoaderCircle from "phosphor-svelte/lib/CircleNotchIcon";
  import PasswordInput from "$lib/components/PasswordInput.svelte";
  import UploadStatus from "./UploadStatus.svelte";

  interface Props {
    isDisposable: boolean;
    isEnabledEncryption: boolean;
    isUploading: Writable<boolean>;
  }

  let { isDisposable, isEnabledEncryption, isUploading }: Props = $props();

  let passphrase = $state("");
  let passphraseInput: ReturnType<typeof PasswordInput> | undefined = $state();
  let file: HTMLInputElement;
  let directory: HTMLInputElement;
  let isReadingFiles = $state(false);
  let uploadStatus: ReturnType<typeof UploadStatus>;
  let dragActive = $state(false);
  let dropZone: HTMLElement;

  // 옵션이 변경될 때 업로드 상태 초기화
  $effect(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    isDisposable;
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    isEnabledEncryption;
    uploadStatus?.reset();
  });

  const determineFileType = (file: File) => {
    if (file.type) {
      return file.type;
    }

    const fileName = file.name.toLowerCase();
    if (fileName.endsWith(".heic")) {
      return "image/heic";
    } else if (fileName.endsWith(".heif")) {
      return "image/heif";
    } else {
      return "";
    }
  };

  // A failure whose message explains to the user what went wrong.
  class UploadFailure extends Error {}

  const tooLarge = (file: File, afterEncryption = false) =>
    `"${file.name}" is too large${afterEncryption ? " after encryption" : ""}. The limit is ${formatSize(MAX_FILE_SIZE)} per file.`;

  const requirePassphrase = () => {
    uploadStatus.displayFailure("Enter a passphrase to encrypt your files.");
    passphraseInput?.focus();
  };

  const encryptFile = async (file: File, secret: string) =>
    new Blob([await encryptOpenSSL(await file.arrayBuffer(), secret)]);

  const handleFile = async (targetFile: File) => {
    if (!targetFile) {
      return;
    } else if (targetFile.size > MAX_FILE_SIZE) {
      uploadStatus.displayFailure(tooLarge(targetFile));
      return;
    } else if (isEnabledEncryption && passphrase === "") {
      requirePassphrase();
      return;
    }

    let targetContent: Blob = targetFile;

    if (isEnabledEncryption) {
      try {
        uploadStatus.displayEncrypting();
        $isUploading = true;

        targetContent = await encryptFile(targetFile, passphrase);
        if (targetContent.size > MAX_FILE_SIZE) {
          uploadStatus.displayFailure(tooLarge(targetFile, true));
          return;
        }
      } catch {
        uploadStatus.displayFailure(
          "Could not encrypt the file. It may be too large to encrypt in your browser.",
        );
        return;
      } finally {
        $isUploading = false;
      }
    }

    const fileType = isEnabledEncryption ? "" : determineFileType(targetFile);
    const meter = throughputMeter();
    // Upload through the same endpoint as curl -T, so the web and the command line
    // cannot drift apart.
    const options = `${isDisposable ? "d" : ""}${isEnabledEncryption ? "e" : ""}`;
    const name = encodeURIComponent(targetFile.name);

    let xhr: XMLHttpRequest;
    $isUploading = true;
    try {
      xhr = await transfer("PUT", options ? `/${options}/${name}` : `/${name}`, {
        headers: { "Content-Type": fileType || "application/octet-stream" },
        body: targetContent,
        onProgress: (loaded, total) => {
          uploadStatus.updateUploadProgress(Math.floor((loaded / total) * 100), meter(loaded));
        },
      });
    } catch {
      uploadStatus.displayFailure(
        "Could not reach the server. Check your connection and try again.",
      );
      return;
    } finally {
      $isUploading = false;
    }
    if (xhr.status !== 201) {
      uploadStatus.displayFailure(requestMessage(xhr));
      return;
    }

    // Location is the download URL, /<id>/<name>.
    const fileID = new URL(
      xhr.getResponseHeader("Location")!,
      window.location.origin,
    ).pathname.split("/")[1];
    const managementToken = xhr.getResponseHeader("X-Management-Token");
    const isImage = fileType.startsWith("image/") && targetFile.size <= MAX_CONVERTIBLE_IMAGE_SIZE;

    // Store file info in localStorage for my page
    if (managementToken) {
      addUploadedFile({
        id: fileID,
        name: targetFile.name,
        managementToken,
        isEncrypted: isEnabledEncryption,
        passphrase: isEnabledEncryption ? passphrase : undefined,
      });
    }

    const path = fileSharePath({
      id: fileID,
      name: targetFile.name,
      isEncrypted: isEnabledEncryption,
    });
    uploadStatus.updateDownloadURL(
      `${window.location.origin}${path}`,
      isEnabledEncryption ? passphrase : null,
      isImage,
    );
  };

  const handleFiles = async (files: File[], folderName?: string) => {
    if ($isUploading || !files.length) return;
    if (files.length === 1) return handleFile(files[0]);
    const oversized = files.find((f) => f.size > MAX_FILE_SIZE);
    if (files.length > 1000) {
      uploadStatus.displayFailure("Choose up to 1000 files.");
      return;
    } else if (oversized) {
      uploadStatus.displayFailure(tooLarge(oversized));
      return;
    }
    const secret = isEnabledEncryption ? passphrase : "";
    if (isEnabledEncryption && !secret) {
      requirePassphrase();
      return;
    }
    $isUploading = true;
    let folder: { folderID: string; managementToken: string; downloadURL: string } | undefined;
    try {
      uploadStatus.updateUploadProgress(0, 0);
      const response = await fetch("/api/folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          count: files.length,
          isDisposable,
          isEncrypted: isEnabledEncryption,
        }),
      });
      if (!response.ok) {
        throw new UploadFailure(
          (await responseMessage(response)) ?? "Could not create the folder. Please try again.",
        );
      }
      folder = await response.json();
      const total = files.reduce((sum, f) => sum + f.size, 0);
      const meter = throughputMeter();
      let completed = 0;
      for (const target of files) {
        let content: Blob = target;
        if (isEnabledEncryption) {
          uploadStatus.displayEncrypting();
          content = await encryptFile(target, secret);
          if (content.size > MAX_FILE_SIZE) throw new UploadFailure(tooLarge(target, true));
        }
        const xhr = await transfer("POST", `/api/folder/${folder!.folderID}`, {
          headers: {
            "X-Management-Token": folder!.managementToken,
            "X-Content-Name": encodeURIComponent(target.name),
            "Content-Type": isEnabledEncryption
              ? "application/octet-stream"
              : determineFileType(target) || "application/octet-stream",
          },
          body: content,
          onProgress: (sent, size) => {
            // Encryption changes the size, so progress is scaled to the original file.
            const loaded = completed + (target.size * sent) / size;
            uploadStatus.updateUploadProgress(
              total ? Math.floor((100 * loaded) / total) : 0,
              meter(loaded),
            );
          },
        });
        if (xhr.status !== 201) {
          throw new UploadFailure(
            requestMessage(xhr) ?? `Could not upload "${target.name}". Please try again.`,
          );
        }
        completed += target.size;
      }
      const finished = await fetch(`/api/folder/${folder!.folderID}`, {
        method: "PATCH",
        headers: { "X-Management-Token": folder!.managementToken },
      });
      if (!finished.ok) {
        throw new UploadFailure(
          (await responseMessage(finished)) ?? "Could not finish the upload. Please try again.",
        );
      }
      let name = `${files[0].name} + ${files.length - 1} more`;
      if (folderName) {
        const renamed = await fetch(`/api/folder/${folder!.folderID}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "X-Management-Token": folder!.managementToken,
          },
          body: JSON.stringify({ name: folderName }),
        });
        if (!renamed.ok) {
          throw new UploadFailure(
            (await responseMessage(renamed)) ?? "Could not name the folder. Please try again.",
          );
        }
        name = (await renamed.json()).name;
      }
      addUploadedFile({
        id: folder!.folderID,
        name,
        kind: "folder",
        fileCount: files.length,
        managementToken: folder!.managementToken,
        isEncrypted: isEnabledEncryption,
        passphrase: secret || undefined,
      });
      uploadStatus.updateDownloadURL(folder!.downloadURL, secret || null, false, {
        id: folder!.folderID,
        name,
        managementToken: folder!.managementToken,
      });
    } catch (cause) {
      if (folder)
        await fetch(`/api/folder/${folder.folderID}`, {
          method: "DELETE",
          headers: { "X-Management-Token": folder.managementToken },
        }).catch(() => {});
      uploadStatus.displayFailure(
        cause instanceof UploadFailure
          ? cause.message
          : "Could not upload the files. Please try again.",
      );
    } finally {
      $isUploading = false;
    }
  };

  const uploadFile = async () => {
    await handleFiles(Array.from(file.files ?? []));
    file.value = "";
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    dragActive = true;
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    if (!dropZone.contains(e.relatedTarget as Node)) {
      dragActive = false;
    }
  };

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault();
    dragActive = false;

    if ($isUploading) return;

    if (!e.dataTransfer) return;
    let selection: Awaited<ReturnType<typeof collectDroppedFiles>>;
    $isUploading = true;
    isReadingFiles = true;
    try {
      selection = await collectDroppedFiles(e.dataTransfer);
    } catch (cause) {
      uploadStatus.displayFailure(
        cause instanceof Error && cause.message === "Choose up to 1000 files."
          ? cause.message
          : "Could not read all files. Please select the folder again.",
      );
      return;
    } finally {
      isReadingFiles = false;
      $isUploading = false;
    }
    if (!selection.files.length) {
      uploadStatus.displayFailure("The selected folders contain no files.");
      return;
    }
    await handleFiles(selection.files, selection.folderName);
    file.value = "";
  };

  const uploadDirectory = async () => {
    const files = Array.from(directory.files ?? []);
    const roots = new Set(files.map((file) => file.webkitRelativePath.split("/")[0]));
    await handleFiles(files, roots.size === 1 ? roots.values().next().value : undefined);
    directory.value = "";
  };

  const handleClick = () => {
    if (!$isUploading) {
      file.click();
    }
  };
</script>

<div class="file-uploader">
  {#if isEnabledEncryption}
    <div class="passphrase-section">
      <label class="field-label" for="upload-passphrase">
        <KeyRound />Encryption Passphrase
      </label>
      <PasswordInput
        id="upload-passphrase"
        bind:this={passphraseInput}
        bind:value={passphrase}
        disabled={$isUploading}
        placeholder="Enter a strong passphrase"
        onkeydown={async (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            await uploadFile();
          }
        }}
      />
    </div>
  {/if}

  <div
    class="drop-zone {dragActive ? 'drag-active' : ''} {$isUploading ? 'uploading' : ''}"
    bind:this={dropZone}
    ondragover={handleDragOver}
    ondragleave={handleDragLeave}
    ondrop={handleDrop}
    role="group"
    aria-label="Upload files or folders"
  >
    <button
      type="button"
      class="drop-zone-target"
      aria-label="Select Files"
      tabindex="-1"
      disabled={$isUploading}
      onclick={handleClick}
    ></button>
    <div class="drop-zone-content">
      {#if $isUploading}
        <div class="upload-icon spinning"><LoaderCircle /></div>
        <h3>{isReadingFiles ? "Reading Folder..." : "Uploading..."}</h3>
        <p>
          {isReadingFiles
            ? "Collecting files from your folders"
            : "Please wait while your files are being uploaded"}
        </p>
      {:else if dragActive}
        <div class="upload-icon"><CloudUpload /></div>
        <h3>Drop Files or Folders Here</h3>
        <p>Release to start uploading</p>
      {:else}
        <div class="upload-icon"><CloudUpload /></div>
        <h3>Drag & Drop Files or Folders</h3>
        <p class="selection-options">
          Or <button type="button" class="select-source" onclick={handleClick}>select files</button>
          <span>or</span>
          <button type="button" class="select-source" onclick={() => directory.click()}
            >select a folder</button
          >
        </p>
        <div class="file-info">
          <span class="file-size-limit"
            >Maximum file size: {formatSize(MAX_FILE_SIZE)} per file</span
          >
        </div>
      {/if}
    </div>
  </div>

  <input
    type="file"
    multiple
    bind:this={file}
    disabled={$isUploading}
    onchange={uploadFile}
    class="file-input"
    aria-label="File upload input"
  />

  <input
    type="file"
    webkitdirectory
    bind:this={directory}
    disabled={$isUploading}
    onchange={uploadDirectory}
    class="file-input"
    aria-label="Folder upload input"
  />

  <UploadStatus bind:this={uploadStatus} />
</div>

<style>
  .file-uploader {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .passphrase-section {
    margin-bottom: 16px;
  }

  .field-label {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .field-label :global(svg) {
    color: var(--color-brand);
  }

  .drop-zone {
    position: relative;
    border: 3px dashed var(--color-brand-border);
    border-radius: 20px;
    padding: 40px 32px;
    text-align: center;
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(10px);
    cursor: pointer;
    transition: all var(--transition);
    min-height: 160px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .drop-zone:hover {
    border-color: var(--color-brand);
    background: var(--color-brand-subtle);
  }

  .drop-zone.drag-active {
    border-color: var(--color-brand);
    background: var(--color-brand-subtle);
    box-shadow: var(--shadow-brand);
  }

  .drop-zone.uploading {
    border-color: var(--color-success-border);
    background: var(--color-success-subtle);
    cursor: not-allowed;
  }

  /* Covers the whole zone so a click anywhere opens the file picker. */
  .drop-zone-target {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    padding: 0;
    border: none;
    border-radius: inherit;
    background: transparent;
  }

  .drop-zone-content {
    position: relative;
    pointer-events: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    max-width: 400px;
  }

  .upload-icon {
    display: flex;
    font-size: 48px;
    color: var(--color-brand);
    transition: transform var(--transition);
  }

  .drop-zone:hover .upload-icon {
    transform: translateY(-2px);
  }

  .spinning :global(svg) {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .spinning :global(svg) {
      animation: none;
    }
  }

  .drop-zone h3 {
    margin: 0;
    font-size: var(--text-xl);
    font-weight: 700;
    color: var(--color-text);
  }

  .drop-zone p {
    margin: 0;
    font-size: var(--text-base);
    color: var(--color-text-secondary);
    line-height: 1.5;
  }

  .file-info {
    margin-top: 8px;
  }

  .file-size-limit {
    font-size: var(--text-md);
    color: var(--color-text-secondary);
    font-weight: 500;
  }

  .selection-options {
    display: flex;
    align-items: baseline;
    justify-content: center;
    flex-wrap: wrap;
    column-gap: 5px;
  }

  .select-source {
    pointer-events: auto;
    padding: 0;
    border: none;
    border-radius: 4px;
    background: none;
    color: var(--color-brand);
    font: inherit;
    font-weight: 600;
  }

  .select-source:hover {
    color: var(--color-brand-accent);
    text-decoration: underline;
  }

  .file-input {
    display: none;
  }

  @media (max-width: 768px) {
    .drop-zone {
      padding: 48px 24px;
    }

    .drop-zone p {
      font-size: var(--text-md);
    }
  }

  @media (max-width: 480px) {
    .drop-zone {
      padding: 32px 16px;
      min-height: 140px;
    }

    .upload-icon {
      font-size: 40px;
    }

    .drop-zone h3 {
      font-size: var(--text-lg);
    }
  }
</style>
