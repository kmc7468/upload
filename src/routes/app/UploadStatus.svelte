<script lang="ts">
  import QRCode from "qrcode";
  import { formatThroughput } from "$lib/utils";

  let status: "encrypting" | "uploading" | "uploaded" | "failed";

  let percent: number;
  let throughput: string;

  let downloadURL: string;
  let isImage: boolean;

  export const displayEncrypting = () => {
    status = "encrypting";
  };
  export const updateUploadProgress = (newPercent: number, newThroughput: number) => {
    status = "uploading";
    percent = newPercent;
    throughput = formatThroughput(newThroughput);
  };
  export const updateDownloadURL = (newDownloadURL: string, newIsImage: boolean) => {
    status = "uploaded";
    downloadURL = newDownloadURL;
    isImage = newIsImage;
  };
  export const displayFailure = () => {
    status = "failed";
  };
</script>

{#if status === "encrypting"}
  <p>Encrypting the file...</p>
{:else if status === "uploading"}
  <p>Uploading the file... ({percent}%, {throughput})</p>
{:else if status === "uploaded"}
  <p>
    Download:
    <a id="download" href={downloadURL}><b>{decodeURI(downloadURL)}</b></a>
    {#if isImage}
      <details>
        <summary>Utility</summary>
        <button on:click={() => downloadURL += "?jpg"}>Convert to JPEG</button>
        <button on:click={() => downloadURL += "?png"}>Convert to PNG</button>
      </details>
    {/if}
    {#await QRCode.toDataURL(downloadURL, { margin: 2, width: 150 }) then qrcode}
      <details>
        <summary>QR code</summary>
        <img src={qrcode} alt="QR code" />
      </details>
    {/await}
  </p>
{:else if status === "failed"}
  <p>Failed to upload the file!</p>
{/if}

<style>
  p {
    margin-bottom: 0;
  }
  #download {
    word-break: break-all;
  }
  details {
    padding: 0 20px;
  }
</style>