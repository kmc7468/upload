<script lang="ts">
  import { writable } from "svelte/store";
  import { browser } from "$app/environment";
  import FileUploader from "./FileUploader.svelte";

  import "$lib/style.css";

  let { data } = $props();

  let isDisposable = $state(false);
  let isEnabledEncryption = $state(false);
  const isUploading = writable(false);

  // "filename" is shown as a placeholder for the user's file.
  const curlCommand = $derived.by(() => {
    const origin = browser ? window.location.origin : "";
    const options = `${isDisposable ? "d" : ""}${isEnabledEncryption ? "e" : ""}`;
    return isEnabledEncryption
      ? `openssl enc -e -aes-256-cbc -pbkdf2 < filename | curl -T - ${origin}/${options}/filename`
      : `curl -T filename ${origin}/${options && `${options}/`}`;
  });
</script>

<svelte:head>
  <title>Minchan's Upload</title>
</svelte:head>

<main class="main">
  <section class="upload-section">
    <div class="section-header">
      <h2 class="section-title">
        <span class="section-icon">⬆️</span>
        Upload Files
      </h2>
      <div class="header-actions">
        <a href="/app/my" class="btn-secondary">📁 My Files</a>
      </div>
    </div>

    <form class="upload-form">
      <div class="uploader-section rounded-box">
        {#if browser}
          <div class="curl-inline">
            <span class="curl-label">You can also use command line:</span>
            <div class="curl-container">
              <code class="curl-command-inline">
                {#each curlCommand.split("filename") as part, index (index)}{#if index}<i
                      >filename</i
                    >{/if}{part}{/each}
              </code>
              <button
                type="button"
                class="curl-copy-btn"
                onclick={() => navigator.clipboard.writeText(curlCommand)}
              >
                📋
              </button>
            </div>
          </div>
        {/if}

        <FileUploader {isDisposable} {isEnabledEncryption} {isUploading} />
      </div>

      <div class="options-section rounded-box">
        <h3>⚙️ Upload Options</h3>
        <p class="options-note">
          Configure these options <strong>before</strong> selecting files.
        </p>

        <div class="options-grid">
          <label class="option-item">
            <input type="checkbox" bind:checked={isDisposable} disabled={$isUploading} />
            <span class="option-label">
              <strong>Single Download</strong>
              <small>Files will be deleted after one complete download</small>
            </span>
          </label>

          {#if browser && window.crypto.subtle}
            <label class="option-item">
              <input type="checkbox" bind:checked={isEnabledEncryption} disabled={$isUploading} />
              <span class="option-label">
                <strong>End-to-End Encryption</strong>
                <small>Files will be encrypted before uploading</small>
              </span>
            </label>
          {/if}
        </div>
      </div>
    </form>
  </section>

  <section class="info-section">
    <div class="info-grid">
      <div class="info-card rounded-box">
        <h3>
          <span class="info-icon">⏱️</span>
          Storage Duration
        </h3>
        <p>
          Files are automatically deleted after <strong>{data.fileExpiry}</strong>. They may be
          removed earlier depending on server capacity.
        </p>
      </div>

      <div class="info-card rounded-box">
        <h3>
          <span class="info-icon">💾</span>
          Storage Capacity
        </h3>
        <p>
          The server has <strong>{data.storageCapacity}</strong> of available storage. During high traffic,
          uploads may be temporarily unavailable.
        </p>
      </div>

      <div class="info-card rounded-box">
        <h3>
          <span class="info-icon">🔒</span>
          Privacy Policy
        </h3>
        <p>
          When uploading files, we <strong>permanently</strong> store: file name, file size, file hash,
          and your IP address.
        </p>
      </div>

      <div class="info-card rounded-box warning-card">
        <h3>
          <span class="info-icon">⚠️</span>
          Important Notice
        </h3>
        <p>
          <strong>Do not upload illegal or sensitive files!</strong>
          Use this service responsibly and at your own risk.
        </p>
      </div>
    </div>
  </section>
</main>

<style>
  .main {
    display: flex;
    flex-direction: column;
    gap: 32px;
  }

  .upload-section {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  .section-title {
    margin: 0;
    font-size: 32px;
    font-weight: 700;
    color: white;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .section-icon {
    font-size: 36px;
  }

  .header-actions {
    display: flex;
    gap: 1rem;
    align-items: center;
  }

  .btn-secondary {
    padding: 0.75rem 1.5rem;
    background: rgba(255, 255, 255, 0.95);
    color: #4a5568;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-radius: 8px;
    font-size: 0.9rem;
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
    transition: all 0.2s ease;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(10px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .btn-secondary:hover {
    background: white;
    border-color: rgba(255, 255, 255, 0.6);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    color: #4a5568;
    text-decoration: none;
  }

  .curl-inline {
    margin-bottom: 32px;
    padding: 12px;
    background: rgba(102, 126, 234, 0.05);
    border: 1px solid rgba(102, 126, 234, 0.15);
    border-radius: 8px;
  }

  .upload-form {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  /* Desktop: 원래 순서 유지 (Options -> Uploader) */
  @media (min-width: 769px) {
    .upload-form {
      flex-direction: column;
    }

    .options-section {
      order: 1;
    }

    .uploader-section {
      order: 2;
    }
  }

  .options-section h3 {
    margin: 0 0 8px 0;
    color: #333;
    font-size: 18px;
    font-weight: 600;
  }

  .options-note {
    margin: 0 0 20px 0;
    color: #666;
    font-size: 14px;
  }

  .options-grid {
    display: flex;
    flex-direction: row;
    gap: 16px;
    flex-wrap: wrap;
  }

  .option-item {
    display: flex;
    align-items: center;
    gap: 18px;
    cursor: pointer;
    padding: 16px;
    border: 2px solid rgba(102, 126, 234, 0.1);
    border-radius: 12px;
    background: rgba(102, 126, 234, 0.05);
    transition: all 0.3s ease;
    flex: 1;
    min-width: 200px;
  }

  .option-item:hover {
    border-color: rgba(102, 126, 234, 0.3);
    background: rgba(102, 126, 234, 0.1);
  }

  .option-item input[type="checkbox"] {
    margin: 0;
    flex-shrink: 0;
    width: 18px;
    height: 18px;
  }

  .option-label {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .option-label strong {
    color: #333;
    font-weight: 600;
  }

  .option-label small {
    color: #666;
    font-size: 13px;
  }

  .info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 24px;
  }

  .info-card {
    text-align: center;
  }

  .warning-card {
    border: 2px solid rgba(239, 68, 68, 0.2);
    background: rgba(254, 242, 242, 0.9);
  }

  .warning-card h3 {
    color: #dc2626;
  }

  .warning-card p {
    color: #7f1d1d;
  }

  @media (max-width: 768px) {
    .section-header {
      flex-direction: column;
      align-items: stretch;
      gap: 1rem;
      margin-bottom: 0;
    }

    .section-title {
      font-size: 28px;
      flex-direction: column;
      gap: 8px;
      align-self: center;
    }

    .header-actions {
      justify-content: center;
    }

    .curl-inline {
      display: none;
    }

    .info-grid {
      grid-template-columns: 1fr;
      gap: 16px;
    }

    .option-item {
      padding: 12px;
    }

    .options-grid {
      flex-direction: column;
    }
  }

  @media (max-width: 480px) {
    .section-title {
      font-size: 24px;
    }
  }
</style>
