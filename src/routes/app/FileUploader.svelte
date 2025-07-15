<script lang="ts">
  import { type Writable } from "svelte/store";
  import { generateSalt, deriveBitsUsingPBKDF2, encryptUsingAES256CBC } from "$lib/cipher";
  import { MAX_FILE_SIZE, MAX_CONVERTIBLE_IMAGE_SIZE } from "$lib/constants";
  import UploadStatus from "./UploadStatus.svelte";

  interface Props {
    isDisposable: boolean;
    isEnabledEncryption: boolean;
    isUploading: Writable<boolean>;
  }

  let { isDisposable, isEnabledEncryption, isUploading }: Props = $props();

  let passphrase: HTMLInputElement | undefined = $state();
  let file: HTMLInputElement;
  let uploadStatus: ReturnType<typeof UploadStatus>;
  let dragActive = $state(false);
  let dropZone: HTMLElement;

  // 옵션이 변경될 때 업로드 상태 초기화
  $effect(() => {
    isDisposable;
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
        alert("An error occurred while encrypting the file. The file may be too large to encrypt in your browser.");
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
        const isImage = fileType.startsWith("image/") && targetFile.size <= MAX_CONVERTIBLE_IMAGE_SIZE;

        if (isEnabledEncryption) {
          uploadStatus.updateDownloadURL(`${window.location.origin}/app/file/${fileID}`, passphrase!.value, false);
        } else {
          uploadStatus.updateDownloadURL(`${window.location.origin}/${fileID}/${encodeURIComponent(targetFile.name)}`, null, isImage);
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
      const percent = Math.floor(event.loaded / event.total * 100);
      const throughput = (event.loaded - loaded) / (now - time) * 1000;

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

  const uploadFile = async () => {
    const targetFile = file.files?.[0];
    if (targetFile) {
      await handleFile(targetFile);
      // Reset the file input to allow selecting the same file again
      file.value = '';
    }
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

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      await handleFile(files[0]);
      // Reset the file input to allow selecting the same file again
      file.value = '';
    }
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
          onkeydown={async event => {
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
    onclick={handleClick}
    role="button"
    tabindex="0"
    onkeydown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClick();
      }
    }}
  >
    <div class="drop-zone-content">
      {#if $isUploading}
        <div class="upload-icon">⏳</div>
        <h3>Uploading...</h3>
        <p>Please wait while your file is being uploaded</p>
      {:else if dragActive}
        <div class="upload-icon">📁</div>
        <h3>Drop your file here</h3>
        <p>Release to start uploading</p>
      {:else}
        <div class="upload-icon">📤</div>
        <h3>Drag & Drop Files</h3>
        <p>Or <strong>click here</strong> to select files</p>
        <div class="file-info">
          <span class="file-size-limit">Maximum file size: 4 GiB</span>
        </div>
      {/if}
    </div>
  </div>

  <input 
    type="file" 
    bind:this={file} 
    disabled={$isUploading} 
    onchange={uploadFile}
    class="file-input"
    aria-label="File upload input"
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

  .drop-zone-content {
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

  .file-input {
    display: none;
  }

  @media (max-width: 768px) {
    .drop-zone {
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
      padding: 32px 16px;
      min-height: 140px;
    }

    .upload-icon {
      font-size: 40px;
    }

    .drop-zone h3 {
      font-size: 18px;
    }

    .drop-zone-content {
      gap: 12px;
    }
  }
</style>