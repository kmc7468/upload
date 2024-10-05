<script lang="ts">
  import QRCode from "qrcode";
  import { goto } from "$app/navigation";
  import { encodeStringInBase64 } from "$lib/cipher";
  import { formatThroughput } from "$lib/utils";

  let status: "encrypting" | "uploading" | "uploaded" | "failed";

  let percent: number;
  let throughput: string;

  let downloadURL: string;
  let passphrase: string | null = null;
  let isImage: boolean;

  let realDownloadURL: string;
  let isPassphraseIncluded = true;

  $: realDownloadURL = passphrase && isPassphraseIncluded ? `${downloadURL}#${encodeStringInBase64(passphrase)}` : downloadURL;

  export const displayEncrypting = () => {
    status = "encrypting";
  };
  export const updateUploadProgress = (newPercent: number, newThroughput: number) => {
    status = "uploading";
    percent = newPercent;
    throughput = formatThroughput(newThroughput);
  };
  export const updateDownloadURL = (newDownloadURL: string, newPassphrase: string | null, newIsImage: boolean) => {
    status = "uploaded";
    downloadURL = newDownloadURL;
    passphrase = newPassphrase;
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
    <a id="download" href={realDownloadURL}><b>{decodeURI(realDownloadURL)}</b></a>
    {#if passphrase}
      <br>
      <label>
        <input type="checkbox" bind:checked={isPassphraseIncluded}>
        Include passphrase in the URL and QR code
      </label>
    {/if}
    {#if isImage && !passphrase}
      <details>
        <summary>Utility</summary>
        <button on:click={() => goto(`${realDownloadURL}?jpg`)}>Convert to JPEG</button>
        <button on:click={() => goto(`${realDownloadURL}?png`)}>Convert to PNG</button>
      </details>
    {/if}
    {#await QRCode.toDataURL(realDownloadURL, { margin: 2, width: 150 }) then qrcode}
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
  input[type="checkbox"] {
    margin-left: 0px;
  }
</style>