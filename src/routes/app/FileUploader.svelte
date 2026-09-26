<script lang="ts">
  import { type Writable } from "svelte/store";
  import { generateSalt, deriveBitsUsingPBKDF2, encryptUsingAES256CBC } from "$lib/cipher";
  import { MAX_FILE_SIZE, MAX_CONVERTIBLE_IMAGE_SIZE } from "$lib/constants";
  import { addUploadedFile } from "$lib/storage";
  import { collectDroppedFiles } from "$lib/dropped-files";
  import UploadStatus from "./UploadStatus.svelte";

  interface Props {
    isDisposable: boolean;
    isEnabledEncryption: boolean;
    isUploading: Writable<boolean>;
  }

  let { isDisposable, isEnabledEncryption, isUploading }: Props = $props();

  let passphrase: HTMLInputElement | undefined = $state();
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

  const encryptFile = async (file: File, passphrase: string) => {
    const saltPrefix = new TextEncoder().encode("Salted__");
    const salt = generateSalt(8); // For compatibility with OpenSSL
    const key = await deriveBitsUsingPBKDF2(passphrase, salt, 256 + 128);

    const data = await file.arrayBuffer();
    const encryptedData = await encryptUsingAES256CBC(data, key.slice(0, 32), key.slice(32, 48));

    const result = new Uint8Array(saltPrefix.length + salt.length + encryptedData.byteLength);
    result.set(saltPrefix, 0);
    result.set(salt, saltPrefix.length);
    result.set(new Uint8Array(encryptedData), saltPrefix.length + salt.length);

    return result;
  };

  const handleFile = async (targetFile: File) => {
    if (!targetFile) {
      return;
    } else if (targetFile.size > MAX_FILE_SIZE) {
      alert("The file is too large.");
      return;
    } else if (isEnabledEncryption && passphrase!.value === "") {
      alert("The passphrase is required.");
      return;
    }

    let targetContent: File | Blob = targetFile;

    if (isEnabledEncryption) {
      try {
        uploadStatus.displayEncrypting();
        $isUploading = true;

        targetContent = new Blob([await encryptFile(targetFile, passphrase!.value)]);
        if (targetContent.size > MAX_FILE_SIZE) {
          uploadStatus.displayFailure();
          alert("The encrypted file is too large.");
          return;
        }
      } catch {
        uploadStatus.displayFailure();
        alert(
          "An error occurred while encrypting the file. The file may be too large to encrypt in your browser.",
        );
        return;
      } finally {
        $isUploading = false;
      }
    }

    const xhr = new XMLHttpRequest();
    const fileType = isEnabledEncryption ? "" : determineFileType(targetFile);

    xhr.addEventListener("loadstart", () => {
      $isUploading = true;
    });
    xhr.addEventListener("load", async () => {
      if (xhr.status === 201) {
        const fileID = xhr.responseText;
        const managementToken = xhr.getResponseHeader("X-Management-Token");
        const isImage =
          fileType.startsWith("image/") && targetFile.size <= MAX_CONVERTIBLE_IMAGE_SIZE;

        // Store file info in localStorage for my page
        if (managementToken) {
          addUploadedFile({
            id: fileID,
            name: targetFile.name,
            managementToken,
            isEncrypted: isEnabledEncryption,
            passphrase: isEnabledEncryption ? passphrase!.value : undefined,
          });
        }

        if (isEnabledEncryption) {
          uploadStatus.updateDownloadURL(
            `${window.location.origin}/app/file/${fileID}`,
            passphrase!.value,
            false,
          );
        } else {
          uploadStatus.updateDownloadURL(
            `${window.location.origin}/${fileID}/${encodeURIComponent(targetFile.name)}`,
            null,
            isImage,
          );
        }

        alert("The file has been uploaded successfully.");
      } else {
        uploadStatus.displayFailure();
        alert("An error occurred while uploading the file.");
      }
    });
    xhr.addEventListener("error", async () => {
      uploadStatus.displayFailure();
      alert("An error occurred while uploading the file.");
    });
    xhr.addEventListener("loadend", () => {
      $isUploading = false;
    });

    let time: number;
    let loaded: number;

    xhr.upload.addEventListener("loadstart", () => {
      time = Date.now();
      loaded = 0;
    });
    xhr.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) {
        return;
      }

      const now = Date.now();
      const percent = Math.floor((event.loaded / event.total) * 100);
      const throughput = ((event.loaded - loaded) / (now - time)) * 1000;

      time = now;
      loaded = event.loaded;
      uploadStatus.updateUploadProgress(percent, throughput);
    });

    xhr.open("POST", "/api/file");

    xhr.setRequestHeader("Content-Type", fileType || "application/octet-stream");
    xhr.setRequestHeader("X-Content-Name", encodeURIComponent(targetFile.name));
    xhr.setRequestHeader("X-Content-Disposable", isDisposable.toString());
    xhr.setRequestHeader("X-Content-Encryption", isEnabledEncryption.toString());

    xhr.send(targetContent);
  };

  const handleFiles = async (files: File[], folderName?: string) => {
    if ($isUploading || !files.length) return;
    if (files.length === 1) return handleFile(files[0]);
    if (files.length > 1000 || files.some((f) => f.size > MAX_FILE_SIZE)) {
      alert("Choose up to 1000 files within the per-file size limit.");
      return;
    }
    const secret = isEnabledEncryption ? passphrase!.value : "";
    if (isEnabledEncryption && !secret) {
      alert("The passphrase is required.");
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
      if (!response.ok) throw new Error("Could not create folder");
      folder = await response.json();
      const total = files.reduce((sum, f) => sum + f.size, 0);
      let completed = 0;
      const started = Date.now();
      for (const target of files) {
        let content: Blob = target;
        if (isEnabledEncryption) {
          uploadStatus.displayEncrypting();
          content = new Blob([await encryptFile(target, secret)]);
          if (content.size > MAX_FILE_SIZE) throw new Error("The encrypted file is too large.");
        }
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", `/api/folder/${folder!.folderID}`);
          xhr.setRequestHeader("X-Management-Token", folder!.managementToken);
          xhr.setRequestHeader("X-Content-Name", encodeURIComponent(target.name));
          xhr.setRequestHeader(
            "Content-Type",
            isEnabledEncryption
              ? "application/octet-stream"
              : determineFileType(target) || "application/octet-stream",
          );
          xhr.upload.onprogress = (event) => {
            const loaded =
              completed + (event.lengthComputable ? (target.size * event.loaded) / event.total : 0);
            uploadStatus.updateUploadProgress(
              total ? Math.floor((100 * loaded) / total) : 0,
              (loaded / Math.max(1, Date.now() - started)) * 1000,
            );
          };
          xhr.onload = () => (xhr.status === 201 ? resolve() : reject(new Error("Upload failed")));
          xhr.onerror = () => reject(new Error("Upload failed"));
          xhr.onabort = () => reject(new Error("Upload cancelled"));
          xhr.send(content);
        });
        completed += target.size;
      }
      const finished = await fetch(`/api/folder/${folder!.folderID}`, {
        method: "PATCH",
        headers: { "X-Management-Token": folder!.managementToken },
      });
      if (!finished.ok) throw new Error("Could not finish upload");
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
        if (!renamed.ok) throw new Error("Could not name folder");
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
      alert("The files have been uploaded successfully.");
    } catch {
      if (folder)
        await fetch(`/api/folder/${folder.folderID}`, {
          method: "DELETE",
          headers: { "X-Management-Token": folder.managementToken },
        }).catch(() => {});
      uploadStatus.displayFailure();
      alert("An error occurred while uploading the files. Please try again.");
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
      alert(
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
      alert("The selected folders contain no files.");
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
      <label class="passphrase-label">
        <span class="label-icon">🔐</span>
        <span class="label-text">Encryption Passphrase</span>
        <input
          type="password"
          disabled={$isUploading}
          bind:this={passphrase}
          placeholder="Enter a strong passphrase..."
          class="passphrase-input"
          onkeydown={async (event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              await uploadFile();
            }
          }}
        />
      </label>
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
        <div class="upload-icon">⏳</div>
        <h3>{isReadingFiles ? "Reading Folder..." : "Uploading..."}</h3>
        <p>
          {isReadingFiles
            ? "Collecting files from your folders"
            : "Please wait while your files are being uploaded"}
        </p>
      {:else if dragActive}
        <div class="upload-icon">📁</div>
        <h3>Drop your files or folders here</h3>
        <p>Release to start uploading</p>
      {:else}
        <div class="upload-icon">📤</div>
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
            >Maximum file size: {(MAX_FILE_SIZE / 1024 ** 3).toLocaleString()} GiB per file</span
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
    padding: 20px;
    background: rgba(255, 193, 7, 0.05);
    border: 2px solid rgba(255, 193, 7, 0.2);
    border-radius: 16px;
    margin-bottom: 16px;
  }

  .passphrase-label {
    display: flex;
    align-items: center;
    gap: 12px;
    font-weight: 600;
    color: #333;
  }

  .label-icon {
    font-size: 20px;
  }

  .label-text {
    font-size: 16px;
  }

  .passphrase-input {
    width: 100%;
    padding: 14px 16px;
    border: 2px solid rgba(255, 193, 7, 0.3);
    border-radius: 12px;
    font-size: 14px;
    background: rgba(255, 255, 255, 0.9);
    transition: all 0.3s ease;
    box-sizing: border-box;
  }

  .passphrase-input:focus {
    border-color: #ffc107;
    box-shadow: 0 0 0 3px rgba(255, 193, 7, 0.1);
    outline: none;
  }

  .passphrase-input::placeholder {
    color: #999;
  }

  .drop-zone {
    position: relative;
    border: 3px dashed rgba(102, 126, 234, 0.3);
    border-radius: 20px;
    padding: 40px 32px;
    text-align: center;
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(10px);
    cursor: pointer;
    transition: all 0.3s ease;
    min-height: 160px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .drop-zone:hover {
    border-color: #667eea;
    background: rgba(102, 126, 234, 0.1);
    transform: translateY(-4px);
    box-shadow: 0 12px 48px rgba(102, 126, 234, 0.2);
  }

  .drop-zone.drag-active {
    border-color: #667eea;
    background: rgba(102, 126, 234, 0.15);
    transform: scale(1.02);
    box-shadow: 0 16px 64px rgba(102, 126, 234, 0.3);
  }

  .drop-zone.uploading {
    border-color: rgba(34, 197, 94, 0.5);
    background: rgba(34, 197, 94, 0.1);
    cursor: not-allowed;
  }

  .drop-zone-target,
  .drop-zone-target:hover,
  .drop-zone-target:disabled {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    background: transparent;
    border-radius: 16px;
    box-shadow: none;
    transform: none;
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
    font-size: 48px;
    opacity: 0.8;
    transition: transform 0.3s ease;
  }

  .drop-zone:hover .upload-icon {
    transform: scale(1.1);
  }

  .drop-zone h3 {
    margin: 0;
    font-size: 20px;
    font-weight: 700;
    color: #333;
    text-shadow: 0 2px 4px rgba(255, 255, 255, 0.5);
  }

  .drop-zone p {
    margin: 0;
    font-size: 16px;
    color: #444;
    line-height: 1.5;
  }

  .file-info {
    margin-top: 8px;
    padding: 8px 16px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    backdrop-filter: blur(5px);
  }

  .file-size-limit {
    font-size: 14px;
    color: #666;
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
    color: #667eea;
    font: inherit;
    font-weight: 600;
    box-shadow: none;
    transform: none;
  }

  .select-source:hover {
    color: #764ba2;
    text-decoration: underline;
    box-shadow: none;
    transform: none;
  }

  .select-source:focus-visible {
    outline: 2px solid #667eea;
    outline-offset: 4px;
  }

  .file-input {
    display: none;
  }

  @media (max-width: 768px) {
    .drop-zone {
      position: relative;
      padding: 48px 24px;
      min-height: 160px;
    }

    .upload-icon {
      font-size: 48px;
    }

    .drop-zone h3 {
      font-size: 20px;
    }

    .drop-zone p {
      font-size: 14px;
    }

    .passphrase-input {
      padding: 12px 14px;
    }
  }

  @media (max-width: 480px) {
    .drop-zone {
      position: relative;
      padding: 32px 16px;
      min-height: 140px;
    }

    .upload-icon {
      font-size: 40px;
    }

    .drop-zone h3 {
      font-size: 18px;
    }

    .drop-zone-target {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      background: transparent;
      border-radius: 16px;
      box-shadow: none;
      transform: none;
    }

    .drop-zone-content {
      position: relative;
      pointer-events: none;
      gap: 12px;
    }
  }
</style>
