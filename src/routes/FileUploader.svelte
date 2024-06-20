<script lang="ts">
  import { ONE_GIBI } from "$lib/constants";
  import UploadStatus from "./UploadStatus.svelte";

  export let isDisposable: boolean;

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

  const uploadFile = () => {
    const targetFile = file.files?.[0];
    if (!targetFile) {
      return;
    } else if (targetFile.size > ONE_GIBI) {
      alert("The file is too large.");
      return;
    }

    const xhr = new XMLHttpRequest();
    const fileType = determineFileType(targetFile);

    xhr.addEventListener("load", async () => {
      if (xhr.status === 200) {
        const downloadURL = xhr.responseText.substring(0, xhr.responseText.length - 1); // 개행 제거
        const isImage = fileType.startsWith("image/");

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
    
    const fileName = encodeURI(targetFile.name);
    const uploadURL = `${window.location.origin}/${isDisposable ? "d/" : ""}${fileName}`;

    xhr.open("PUT", uploadURL);
    xhr.setRequestHeader("Content-Type", fileType || "application/octet-stream");
    xhr.send(targetFile);
  };
</script>

<input type="file" bind:this={file} on:change={uploadFile} />
<UploadStatus bind:this={uploadStatus} />