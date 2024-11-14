<script lang="ts">
  import { writable } from "svelte/store";
  import { browser } from "$app/environment";
  import FileUploader from "./FileUploader.svelte";

  import "$lib/style.css";

  let isDisposable = $state(false);
  let isEnabledEncryption = $state(false);
  const isUploading = writable(false);
</script>

<svlete:head>
  <title>Minchan's Upload</title>
</svlete:head>

<main>
  <section>
    <h2>Upload</h2>
    {#if browser}
      <p>
        You may use <code>curl</code> to upload like this:
        {#if isEnabledEncryption}
          <code>
            openssl enc -e -aes-256-cbc -pbkdf2 &lt; <i>your_filename</i> |
            curl --upload-file -
            {#if isDisposable}
              {window.location.origin}/de/<i>your_filename</i>
            {:else}
              {window.location.origin}/e/<i>your_filename</i>
            {/if}
          </code>
        {:else}
          <code>
            curl --upload-file <i>your_filename</i>
            {#if isDisposable}
              {window.location.origin}/d/<i>your_filename</i>
            {:else}
              {window.location.origin}
            {/if}
          </code>
        {/if}
      </p>
    {/if}
    <form>
      <section id="options" class="rounded-box">
        <p>Change below options <strong>before</strong> selecting a file, if you want to.</p>
        <label>
          <input type="checkbox" bind:checked={isDisposable} disabled={$isUploading} />
          Allow only one download
        </label><br>
        {#if browser && window.crypto.subtle}
          <label>
            <input type="checkbox" bind:checked={isEnabledEncryption} disabled={$isUploading} />
            Encrypt the file before uploading (E2EE)
          </label>
        {/if}
      </section>
      <section class="rounded-box">
        <FileUploader
          isDisposable={isDisposable}
          isEnabledEncryption={isEnabledEncryption}
          isUploading={isUploading} />
      </section>
    </form>
  </section>
  <section>
    <h2>Notes</h2>
    <p>
      You can upload files up to <strong>4 GiB</strong> in size.
      Uploaded files are automatically deleted after <strong>24 hours.</strong>
      However, they may be deleted earlier depending on the server's situation.
    </p>
    <p>
      The server has 16 GiB of storage space available.
      In case of high user traffic, it may not be possible to upload files.
    </p>
    <p>
      The following information will be <strong>permanently</strong> stored on the server when uploading or downloading files:
      the name, size, hash of the uploaded file, and your IP address.
    </p>
    <p>
      You can download files with just a 5-letters ID assigned to each file.
      <strong>Do not upload illegal or important files!</strong>
    </p>
  </section>
</main>

<style>
  form {
    width: fit-content;
  }
  #options {
    margin-bottom: 16px;
  }
  #options p {
    margin-top: 0;
  }
</style>