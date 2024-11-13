<script lang="ts">
  import QRCode from "qrcode";
  import { goto } from "$app/navigation";
  import { encodeStringInBase64 } from "$lib/cipher";
  import { formatThroughput } from "$lib/utils";

  type Status =
    | {
        status: "encrypting";
      }
    | {
        status: "uploading";
        percent: number;
        throughput: string;
      }
    | {
        status: "uploaded";
        downloadURL: string;
        isImage: boolean;
        passphrase: string | null;
      }
    | {
        status: "failed";
      };

  let status: Status | undefined = $state();
  let isPassphraseIncluded = $state(true);

  let realDownloadURL: string | undefined = $derived(
    isPassphraseIncluded && status?.status === "uploaded" && status.passphrase
      ? `${status.downloadURL}#${encodeStringInBase64(status.passphrase)}`
      : status?.status === "uploaded"
      ? status.downloadURL
      : undefined
  );

  export const displayEncrypting = () => {
    status = {
      status: "encrypting",
    };
  };
  export const updateUploadProgress = (newPercent: number, newThroughput: number) => {
    status = {
      status: "uploading",
      percent: newPercent,
      throughput: formatThroughput(newThroughput),
    };
  };
  export const updateDownloadURL = (newDownloadURL: string, newPassphrase: string | null, newIsImage: boolean) => {
    status = {
      status: "uploaded",
      downloadURL: newDownloadURL,
      isImage: newIsImage,
      passphrase: newPassphrase,
    };
  };
  export const displayFailure = () => {
    status = {
      status: "failed",
    };
  };
</script>

{#if status?.status === "encrypting"}
  <p>Encrypting the file...</p>
{:else if status?.status === "uploading"}
  <p>Uploading the file... ({status.percent}%, {status.throughput})</p>
{:else if status?.status === "uploaded" && realDownloadURL}
  <p>
    Download:
    <a id="download" href={realDownloadURL}><b>{decodeURI(realDownloadURL)}</b></a>
    {#if status.passphrase}
      <br>
      <label>
        <input type="checkbox" bind:checked={isPassphraseIncluded}>
        Include passphrase in the URL and QR code
      </label>
    {/if}
    {#if status.isImage && !status.passphrase}
      <details>
        <summary>Utility</summary>
        <button onclick={() => goto(`${realDownloadURL}?jpg`)}>Convert to JPEG</button>
        <button onclick={() => goto(`${realDownloadURL}?png`)}>Convert to PNG</button>
      </details>
    {/if}
    {#await QRCode.toDataURL(realDownloadURL, { margin: 2, width: 150 }) then qrcode}
      <details>
        <summary>QR code</summary>
        <img src={qrcode} alt="QR code" />
      </details>
    {/await}
  </p>
{:else if status?.status === "failed"}
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
  input[type="checkbox"] {
    margin-left: 0px;
  }
</style>