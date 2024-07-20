<script lang="ts">
  import { writable } from "svelte/store";
  import FileUploader from "./FileUploader.svelte";

  let isDisposable = false;
  let isEnabledEncryption = false;
  const isUploading = writable(false);
</script>

<svlete:head>
  <title>Minchan's Upload</title>
</svlete:head>

<main>
  <section>
    <h2>Upload</h2>
    <p>
      You may use <code>curl</code> to upload like this:
      <code hidden={isDisposable}>curl --upload-file your_filename https://upload.minchan.me</code>
      <code hidden={!isDisposable}>curl --upload-file your_filename https://upload.minchan.me/d/your_filename</code>
    </p>
    <form>
      <section id="options">
        <p>Change below options <strong>before</strong> selecting a file, if you want to.</p>
        <label>
          <input type="checkbox" bind:checked={isDisposable} disabled={$isUploading} />
          Allow only one download
        </label><br>
        <label>
          <input type="checkbox" bind:checked={isEnabledEncryption} disabled={$isUploading} />
          Encrypt the file before uploading (E2EE)
        </label>
      </section>
      <section>
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
      You can upload files up to <strong>1 GiB</strong> in size.
      Uploaded files are automatically deleted after <strong>1 hour.</strong>
      However, they may be deleted earlier depending on the server's situation.
    </p>
    <p>
      The server has 4 GiB of storage space available.
      In case of high user traffic, it may not be possible to upload files.
    </p>
    <p>
      The following information will be <strong>permanently</strong> stored on the server when uploading or downloading files:
      the name, size, hash of the uploaded file, and your IP address.
    </p>
    <p>
      You can download files with just a 6-letters ID assigned to each file.
      <strong>Do not upload illegal or important files!</strong>
    </p>
  </section>
</main>

<style>
  code {
    background-color: #EEEEEE;
    border-radius: 3px;
    padding: 1px 3px;
  }
  form {
    width: fit-content;
  }
  form section {
    background-color: #EEEEEE;
    border-radius: 10px;
    box-sizing: border-box;
    padding: 5px 10px;
  }
  #options {
    margin-bottom: 16px;
  }
  #options p {
    margin-top: 0;
  }
</style>