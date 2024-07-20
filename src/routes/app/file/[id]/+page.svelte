<script lang="ts">
  import FileSaver from "file-saver";
  import { browser } from "$app/environment";
  import { deriveBitsUsingPBKDF2, decryptUsingAES256CBC } from "$lib/cipher";
  import { formatThroughput } from "$lib/utils";
  import type { PageData } from "./$types";

  export let data: PageData;

  let downloadURL = "";
  const isImage = data.file?.contentType.startsWith("image/") || false;

  if (browser && data.file) {
    downloadURL = `${window.location.origin}/${data.file.id}/${encodeURI(data.file.name)}`;
  }

  let passphrase = "";
  let isDownloading = false;
  let downloadStatus = "";

  const downloadFile = () => {
    return new Promise<ArrayBuffer>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.responseType = "arraybuffer";

      let time: number;
      let loaded: number;

      xhr.addEventListener("loadstart", () => {
        time = Date.now();
        loaded = 0;
      });
      xhr.addEventListener("load", () => {
        if (xhr.status === 200) {
          resolve(xhr.response as ArrayBuffer);
        } else {
          reject();
        }
      });
      xhr.addEventListener("error", reject);

      xhr.addEventListener("progress", (event) => {
        if (!event.lengthComputable) {
          return;
        }

        const now = Date.now();
        const percent = Math.round((event.loaded / event.total) * 100);
        const throughput = ((event.loaded - loaded) / (now - time)) * 1000;

        time = now;
        loaded = event.loaded;

        downloadStatus = `Downloading the encrypted file... (${percent}%, ${formatThroughput(throughput)})`;
      });

      xhr.open("GET", downloadURL);
      xhr.send();
    });
  };

  const decryptFile = async (encryptedFile: ArrayBuffer) => {
    try {
      downloadStatus = "Decrypting the file...";

      const salt = new Uint8Array(encryptedFile.slice(8, 16));
      const key = await deriveBitsUsingPBKDF2(passphrase, salt, 256 + 128);
      const file = await decryptUsingAES256CBC(encryptedFile.slice(16), key.slice(0, 32), key.slice(32, 48));

      downloadStatus = "Succeeded in decrypting the file!";
      return file;
    } catch (error) {
      console.log(error);
      downloadStatus = "Failed to decrypt the file!";
      throw error;
    }
  };

  let encryptedFile: ArrayBuffer | undefined;
  let file: Blob | undefined;

  const downloadAndDecryptFile = async () => {
    if (!encryptedFile) {
      try {
        isDownloading = true;

        encryptedFile = await downloadFile();
      } catch {
        isDownloading = false;
        downloadStatus = "Failed to download the encrypted file!";

        alert("An error occurred while downloading the encrypted file.");
        return;
      }
    }

    if (!file) {
      try {
        isDownloading = true;
        downloadStatus =  "Decrypting the file...";

        file = new Blob([await decryptFile(encryptedFile!)]);

        isDownloading = false;
        downloadStatus = "Succeeded in decrypting the file!";
      } catch {
        isDownloading = false;
        downloadStatus = "Failed to decrypt the file!";

        alert("An error occurred while decrypting the file. Check the passphrase.");
        return;
      }
    }

    FileSaver.saveAs(file, data.file!.name);
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
  <section>
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
                async event => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    await downloadAndDecryptFile();
                  }
                }
              } />
            </label>
          </form>
          {#if passphrase !== ""}
            <button disabled={isDownloading} on:click={downloadAndDecryptFile}>
              {#if downloadStatus === "" ||
                   downloadStatus.startsWith("Downloading") ||
                   downloadStatus.startsWith("Failed to download")}

                Download and Decrypt
              {:else if downloadStatus.startsWith("Decrypting") ||
                        downloadStatus.startsWith("Failed to decrypt")}

                Decrypt
              {:else}
                Save as file
              {/if}
            </button>
            {#if downloadStatus !== ""}
              <p>{downloadStatus}</p>
            {/if}
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
  </section>
  <section>
    <h2>Notes</h2>
    <p>
      The following information will be <strong>permanently</strong> stored on the server when downloading files:
      the name, size, hash of the uploaded file, and your IP address.
    </p>
  </section>
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