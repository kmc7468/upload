<script lang="ts">
  import FileSaver from "file-saver";
  import { onMount, tick } from "svelte";
  import { browser } from "$app/environment";
  import { decodeStringFromBase64, deriveBitsUsingPBKDF2, decryptUsingAES256CBC } from "$lib/cipher";
  import { formatThroughput } from "$lib/utils";

  import "$lib/style.css";

  let { data } = $props();

  const isImage = data.file?.contentType.startsWith("image/") ?? false;

  let downloadURL = $state("");
  let downloadStatus = $state("");
  let passphrase = $state("");

  const downloadEncryptedFile = () => {
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
    downloadStatus = "Decrypting the file...";

    const salt = new Uint8Array(encryptedFile.slice(8, 16));
    const key = await deriveBitsUsingPBKDF2(passphrase, salt, 256 + 128);
    const file = await decryptUsingAES256CBC(encryptedFile.slice(16), key.slice(0, 32), key.slice(32, 48));

    downloadStatus = "Succeeded in decrypting the file!";
    return file;
  };

  let isDownloading = $state(false);
  let encryptedFile: ArrayBuffer | undefined;
  let file: Blob | undefined = $state();

  const downloadAndDecryptFile = async () => {
    if (!encryptedFile) {
      try {
        isDownloading = true;
        encryptedFile = await downloadEncryptedFile();
      } catch {
        downloadStatus = "Failed to download the encrypted file!";

        alert("An error occurred while downloading the encrypted file. The file may be expired.");
        return;
      } finally {
        isDownloading = false;
      }
    }

    if (!file) {
      try {
        isDownloading = true;
        file = new Blob([await decryptFile(encryptedFile!)]);
      } catch {
        downloadStatus = "Failed to decrypt the file!";

        alert("An error occurred while decrypting the file. Your passphrase may be incorrect.");
        return;
      } finally {
        isDownloading = false;
      }
    }

    FileSaver.saveAs(file, data.file!.name);
  };

  onMount(async () => {
    if (!data.file) return;

    downloadURL = `${window.location.origin}/${data.file.id}/${encodeURIComponent(data.file.name)}`;

    if (!data.file.isEncrypted) return;

    passphrase = decodeStringFromBase64(window.location.hash.slice(1));

    if (!passphrase) return;

    await tick();
    await downloadAndDecryptFile();
  });
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
      {#if browser}
        <p>
          You may use <code>curl</code> to download like this:
          {#if data.file.isEncrypted}
            <code>curl -s {window.location.origin}/{data.file.id} | openssl enc -d -aes-256-cbc -pbkdf2 &gt; "{data.file.name}"</code>
          {:else}
            You may use <code>curl</code> to download like this:
            <code>curl -O "{window.location.origin}/{data.file.id}/{data.file.name}"</code>
          {/if}
        </p>
      {/if}
      <section id="download-section">
        <p class="rounded-box">
          Name: {data.file.name}
          {#if !data.file.isEncrypted}
            <br>Content Type: {data.file.contentType}
          {/if}
        </p>
        {#if data.file.isEncrypted}
          <form class="rounded-box">
            <p>
              The file is encrypted!
              You need the passphrase to download and decrypt it.
            </p>
            <label>
              Passphrase:&nbsp;
              <input type="password" disabled={isDownloading || !!file} bind:value={passphrase} onkeydown={async event => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    await downloadAndDecryptFile();
                  }
                }} />
            </label>
            {#if passphrase !== ""}
              <div>
                <button id="download-decrypt" disabled={isDownloading} onclick={downloadAndDecryptFile}>
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
                  <p id="download-status">{downloadStatus}</p>
                {/if}
              </div>
            {/if}
          </form>
        {:else if downloadURL !== ""}
          <p class="rounded-box">
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
  #download-section {
    width: fit-content;
  }
  form p {
    margin-top: 0;
    margin-bottom: 4px;
  }
  form label {
    align-items: center;
    display: flex;
  }
  form label input {
    flex-grow: 1;
  }
  form div {
    align-items: center;
    display: flex;
    flex-direction: row;
    margin-top: 16px;
  }
  #download-decrypt {
    display: inline-block;
  }
  #download-status {
    display: inline-block;
    margin-left: 8px;
    margin-bottom: 0;
  }
  #download {
    word-break: break-all;
  }
</style>