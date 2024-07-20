<script lang="ts">
  import FileSaver from "file-saver";
  import { browser } from "$app/environment";
  import { deriveBitsUsingPBKDF2, decryptUsingAES256CBC } from "$lib/cipher";
  import type { PageData } from "./$types";

  export let data: PageData;

  let downloadURL = "";
  const isImage = data.file?.contentType.startsWith("image/") || false;

  if (browser && data.file) {
    downloadURL = `${window.location.origin}/${data.file.id}/${encodeURI(data.file.name)}`;
  }

  let passphrase: string = "";
  let isDownloading = false;

  const decryptFile = async (encryptedFile: ArrayBuffer) => {
    const salt = new Uint8Array(encryptedFile.slice(8, 16));
    const key = await deriveBitsUsingPBKDF2(passphrase, salt, 256 + 128);
    return await decryptUsingAES256CBC(encryptedFile.slice(16), key.slice(0, 32), key.slice(32, 48));
  };

  const downloadEncryptedFile = async () => {
    try {
      isDownloading = true;

      const response = await fetch(downloadURL);
      if (response.status === 404) {
        alert("The file is expired.")
        return;
      } else if (!response.ok) {
        alert("An error occurred while downloading the file.");
        return;
      }

      try {
        const encryptedFile = await response.arrayBuffer();
        const file = new Blob([await decryptFile(encryptedFile)]);
        FileSaver.saveAs(file, data.file!.name);
      } catch {
        alert("An error occurred while decrypting the file. Check the passphrase.");
      }
    } finally {
      isDownloading = false;
    }
  };
</script>

<svlete:head>
  <title>
    {#if data.file === null}
      File not found - Minchan's Upload
    {:else}
      {data.file.name} - Minchan's Upload
    {/if}
  </title>
</svlete:head>

<main>
  <h2>Download</h2>
  {#if data.file === null}
    <p>File not found!</p>
  {:else}
    <section>
      <p>Name: {data.file.name}</p>
      {#if !data.file.isEncrypted}
        <p>Content Type: {data.file.contentType}</p>
      {/if}

      {#if data.file.isEncrypted}
        <form>
          <p>
            The file is encrypted!
            You need the passphrase to download and decrypt it.
          </p>
          <label>
            Passphrase:&nbsp;
            <input type="password" disabled={isDownloading} bind:value={passphrase} on:keydown={
              (event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  downloadEncryptedFile();
                }
              }
            } />
          </label>
        </form>
        {#if passphrase !== ""}
          <button disabled={isDownloading} on:click={downloadEncryptedFile}>Download and decrypt</button>
        {/if}
      {:else}
        <p>
          Download URL:
          <a id="download" href={downloadURL}><b>{decodeURI(downloadURL)}</b></a>
          {#if isImage}
            (convert to <a href={`${downloadURL}?jpg`}>JPEG</a> or <a href={`${downloadURL}?png`}>PNG</a>)
          {/if}
        </p>
      {/if}
    </section>
  {/if}
</main>

<style>
  form {
    width: fit-content;
    margin: 16px 0;
  }
  form p {
    margin-bottom: 4px;
  }
  form label {
    align-items: center;
    display: flex;
  }
  form label input {
    flex-grow: 1;
  }
   #download {
    word-break: break-all;
  }
</style>