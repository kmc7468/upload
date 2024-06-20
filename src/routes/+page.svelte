<script lang="ts">
  import RedirectForKaist from "./RedirectForKAIST.svelte";

  let isDisposable = false;
</script>

<svlete:head>
  <title>Minchan's Upload</title>
</svlete:head>

<header>
  <h1>Minchan's Upload</h1>
  <aside><p>
    GitHub: <a href="https://github.com/kmc7468/upload">https://github.com/kmc7468/upload</a><br>
    Contact: <a href="mailto:me@minchan.me">me@minchan.me</a>
  </aside>
  <aside>
    <RedirectForKaist />
  </aside>
</header>

<main>
  <section>
    <h2>Upload</h2>
    <p>
      You may use <code>curl</code> to upload like this:
      <code hidden={isDisposable}>curl --upload-file your_filename https://upload.minchan.me</code>
      <code hidden={!isDisposable}>curl --upload-file your_filename https://upload.minchan.me/d/your_filename</code>
    </p>
    <form>
      <label>
        <input type="checkbox" bind:checked={isDisposable} />
        Allow only one download (check or uncheck it <strong>before</strong> selecting a file)
      </label>
      <br><br>
      <input type="file" />
    </form>
    <p>
      <!-- TODO -->
    </p>
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
</style>