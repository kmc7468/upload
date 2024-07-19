<script lang="ts">
  import { type Writable } from "svelte/store";
  import { generateSalt, deriveBitsUsingPBKDF2, decryptUsingAES256CBC, encryptUsingAES256CBC } from "$lib/cipher";
  import { MAX_FILE_SIZE, MAX_CONVERTIBLE_IMAGE_SIZE } from "$lib/constants";
  import UploadStatus from "./UploadStatus.svelte";

  export let isDisposable: boolean;
  export let isEncryption: boolean;
  export let isUploading: Writable<boolean>;

  let passphrase = "";
  let file: HTMLInputElement;
  let uploadStatus: UploadStatus;

  const determineFileType = (file: File) => {
    if (file.type) {
      return file.type
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

  const encryptFile = async (file: File) => {
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
    } else if (isEncryption && passphrase === "") {
      alert("The passphrase is required.");
      return;
    }

    const xhr = new XMLHttpRequest();
    const fileType = isEncryption ? "application/octet-stream" : determineFileType(targetFile);

    xhr.addEventListener("loadstart", () => {
      file.disabled = true;
      $isUploading = true;
    });
    xhr.addEventListener("load", async () => {
      if (xhr.status === 200) {
        const downloadURL = xhr.responseText.substring(0, xhr.responseText.length - 1); // 개행 제거
        const isImage = fileType.startsWith("image/") && targetFile.size <= MAX_CONVERTIBLE_IMAGE_SIZE;

        uploadStatus.updateDownloadURL(downloadURL, isImage);
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
      file.disabled = false;
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
    
    const fileName = encodeURI(targetFile.name + (isEncryption ? ".enc" : ""));
    const uploadURL = `${window.location.origin}/${isDisposable ? "d/" : ""}${fileName}`;
    let body: File | Uint8Array;

    if (isEncryption) {
      body = await encryptFile(targetFile);
      if (body.byteLength > MAX_FILE_SIZE) {
        alert("The encrypted file is too large.");
        return;
      }
    } else {
      body = targetFile;
    }

    xhr.open("PUT", uploadURL);
    xhr.setRequestHeader("Content-Type", fileType || "application/octet-stream");
    xhr.send(body);
  };
</script>

{#if isEncryption}
  <label id="passphrase">
    Passphrase:&nbsp;
    <input type="password" bind:value={passphrase} />
  </label>
{/if}
<label>
  Upload:&nbsp;
  <input type="file" bind:this={file} on:change={uploadFile} />
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