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

  const uploadFile = async () => {
    const targetFile = file.files?.[0];
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
        alert("An error occurred while encrypting the file.");
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

    const formData = new FormData();
    formData.append("options", JSON.stringify({
      name: targetFile.name,
      contentType: fileType || "application/octet-stream",

      isDisposable,
      isEncrypted: isEnabledEncryption,
    }));
    formData.append("file", targetContent);

    xhr.open("POST", "/api/file/upload");
    xhr.send(formData);
  };
</script>

{#if isEnabledEncryption}
  <label id="passphrase">
    Passphrase:&nbsp;
    <input type="password" disabled={$isUploading}
      bind:this={passphrase} onkeydown={async event => {
        if (event.key === "Enter") {
          event.preventDefault();
          await uploadFile();
        }
      }} />
  </label>
{/if}
<label>
  Upload:&nbsp;
  <input type="file" bind:this={file} disabled={$isUploading} onchange={uploadFile} />
</label>

<UploadStatus bind:this={uploadStatus} />

<style>
  label {
    align-items: center;
    display: flex;
  }
  #passphrase {
    margin-bottom: 5px;
  }
  input {
    flex-grow: 1;
  }
</style>