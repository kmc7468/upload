<script lang="ts">
  type Status = "uploading" | "uploaded" | "failed";

  let status: Status;
  let percent: number;
  let throughput: string;
  let downloadURL: string;

  const formatThroughput = (throughput: number) => {
    const ONE_KIBI = 1024;
    const ONE_MEBI = 1024 * ONE_KIBI;
    const ONE_GIBI = 1024 * ONE_MEBI;

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
  export const updateDownloadURL = (newDownloadURL: string) => {
    status = "uploaded";
    downloadURL = newDownloadURL;
  }
  export const displayFailure = () => {
    status = "failed";
  }
</script>

<p>
  {#if status === "uploading"}
    Uploading the file... ({percent}%, {throughput})
  {:else if status === "uploaded"}
    Download URL:
    <a href={downloadURL}><b>{decodeURI(downloadURL)}</b></a>
  {:else if status === "failed"}
    Failed to upload the file!
  {/if}
</p>

<style>
  a {
    word-break: break-all;
  }
</style>