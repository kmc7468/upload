<script lang="ts">
  import { ONE_KIBI, ONE_MEBI, ONE_GIBI } from "$lib/constants";

  let status: "uploading" | "uploaded" | "failed";

  let percent: number;
  let throughput: string;

  let downloadURL: string;
  let isImage: boolean;

  const formatThroughput = (throughput: number) => {
    if (throughput < ONE_KIBI) {
      return `${throughput} B/s`;
    } else if (throughput < ONE_MEBI) {
      return `${Math.round(throughput / ONE_KIBI)} KiB/s`;
    } else if (throughput < ONE_GIBI) {
      return `${Math.round(throughput / ONE_MEBI)} MiB/s`;
    } else {
      return `${Math.round(throughput / ONE_GIBI)} GiB/s`;
    }
  };

  export const updateUploadProgress = (newPercent: number, newThroughput: number) => {
    status = "uploading";
    percent = newPercent;
    throughput = formatThroughput(newThroughput);
  }
  export const updateDownloadURL = (newDownloadURL: string, newIsImage: boolean) => {
    status = "uploaded";
    downloadURL = newDownloadURL;
    isImage = newIsImage;
  }
  export const displayFailure = () => {
    status = "failed";
  }
</script>

{#if status === "uploading"}
  <p>Uploading the file... ({percent}%, {throughput})</p>
{:else if status === "uploaded"}
  <p>
    Download:
    <a id="download" href={downloadURL}><b>{decodeURI(downloadURL)}</b></a>
    {#if isImage}
      (convert to <a href={`${downloadURL}?jpg`}>JPEG</a> or <a href={`${downloadURL}?png`}>PNG</a>)
    {/if}
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
</style>