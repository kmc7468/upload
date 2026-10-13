<script lang="ts">
  import FileSaver from "file-saver";
  import { onMount, tick } from "svelte";
  import { browser } from "$app/environment";
  import { decryptOpenSSL } from "$lib/cipher";
  import { getUploadedFiles } from "$lib/storage";
  import { throughputMeter, transfer } from "$lib/transfer";
  import { convertedPath, downloadPath, passphraseFromHash } from "$lib/urls";
  import { formatThroughput } from "$lib/utils";

  import "$lib/style.css";

  let { data } = $props();

  const isImage = $derived(data.file?.contentType.startsWith("image/") ?? false);

  let downloadURL = $state("");
  let downloadStatus = $state("");
  let passphrase = $state("");

  const downloadEncryptedFile = async () => {
    const meter = throughputMeter();
    const xhr = await transfer("GET", downloadURL, {
      responseType: "arraybuffer",
      onProgress: (loaded, total) => {
        const percent = Math.round((loaded / total) * 100);
        downloadStatus = `Downloading the encrypted file... (${percent}%, ${formatThroughput(meter(loaded))})`;
      },
    });
    if (xhr.status !== 200) {
      throw new Error("Download failed");
    }

    return xhr.response as ArrayBuffer;
  };

  const decryptFile = async (encryptedFile: ArrayBuffer) => {
    downloadStatus = "Decrypting the file...";
    const file = await decryptOpenSSL(encryptedFile, passphrase);
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

    downloadURL = `${window.location.origin}${downloadPath(data.file.id, data.file.name)}`;

    if (!data.file.isEncrypted) return;

    const fromURL = !!window.location.hash;
    try {
      passphrase = fromURL
        ? passphraseFromHash(window.location.hash)
        : getUploadedFiles().find(
            (stored) =>
              !stored.isExpired &&
              (data.file!.folderId
                ? stored.kind === "folder" && stored.id === data.file!.folderId
                : stored.kind !== "folder" && stored.id === data.file!.id),
          )?.passphrase || "";
    } catch {
      // Invalid URL fragments or unavailable storage still allow manual entry.
      passphrase = "";
    }

    // Saved passphrases only fill the input, so opening a page does not consume
    // a Single Download file. Keep automatic download for explicit URL secrets.
    if (!fromURL || !passphrase) return;

    await tick();
    await downloadAndDecryptFile();
  });
</script>

<svelte:head>
  <title
    >{data.file === null
      ? "File not found - Minchan's Upload"
      : `${data.file.name} - Minchan's Upload`}</title
  >
</svelte:head>

<main class="main">
  <section class="download-section">
    <div class="section-header">
      <h2 class="section-title">
        <span class="section-icon">⬇️</span>
        Download File
      </h2>
    </div>

    {#if data.file === null}
      <div class="error-card rounded-box">
        <div class="error-icon">❌</div>
        <div class="error-content">
          <h3>File Not Found</h3>
          <p>The requested file does not exist or has expired.</p>
        </div>
      </div>
    {:else}
      <div class="file-info-card rounded-box">
        <div class="file-icon">📄</div>
        <div class="file-details">
          <h3 class="file-name">{data.file.name}</h3>
          {#if !data.file.isEncrypted}
            <p class="file-type">
              Content Type: <code>{data.file.contentType}</code>
            </p>
          {/if}
          {#if data.file.isEncrypted}
            <div class="encryption-badge">
              <span class="badge-icon">🔐</span>
              <span>End-to-End Encrypted</span>
            </div>
          {/if}
        </div>
        {#if data.file.folderId}
          <a href={`/app/folder/${data.file.folderId}`} class="folder-button">📁 Open Folder</a>
        {/if}
      </div>

      {#if data.file.isEncrypted}
        <div class="decrypt-section rounded-box">
          <div class="decrypt-header">
            <h3>
              <span class="decrypt-icon">🔓</span>
              Decrypt File
            </h3>
            <p class="decrypt-description">
              This file is encrypted. Enter the passphrase to download and decrypt it.
            </p>
          </div>

          <div class="passphrase-form">
            <label class="passphrase-label">
              <span class="label-text">Passphrase</span>
              <input
                type="password"
                disabled={isDownloading || !!file}
                bind:value={passphrase}
                placeholder="Enter decryption passphrase..."
                class="passphrase-input"
                onkeydown={async (event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    await downloadAndDecryptFile();
                  }
                }}
              />
            </label>

            {#if passphrase !== ""}
              <div class="download-controls">
                <button
                  class="download-button"
                  disabled={isDownloading}
                  onclick={downloadAndDecryptFile}
                >
                  <span class="button-icon">
                    {#if downloadStatus === "" || downloadStatus.startsWith("Downloading") || downloadStatus.startsWith("Failed to download")}
                      ⬇️
                    {:else if downloadStatus.startsWith("Decrypting") || downloadStatus.startsWith("Failed to decrypt")}
                      🔓
                    {:else}
                      💾
                    {/if}
                  </span>
                  <span class="button-text">
                    {#if downloadStatus === "" || downloadStatus.startsWith("Downloading") || downloadStatus.startsWith("Failed to download")}
                      Download and Decrypt
                    {:else if downloadStatus.startsWith("Decrypting") || downloadStatus.startsWith("Failed to decrypt")}
                      Decrypt
                    {:else}
                      Save as File
                    {/if}
                  </span>
                </button>

                {#if downloadStatus !== ""}
                  <div
                    class="status-indicator {downloadStatus.startsWith('Failed')
                      ? 'error'
                      : downloadStatus.startsWith('Succeeded')
                        ? 'success'
                        : 'progress'}"
                  >
                    <span class="status-text">{downloadStatus}</span>
                  </div>
                {/if}
              </div>
            {/if}

            {#if browser}
              <div class="curl-inline">
                <span class="curl-label">Or use command line:</span>
                <div class="curl-container">
                  <code class="curl-command-inline">
                    curl -s {window.location.origin}/{data.file.id} | openssl enc -d -aes-256-cbc -pbkdf2
                    &gt; "{data.file.name}"
                  </code>
                  <button
                    type="button"
                    class="curl-copy-btn"
                    onclick={() => {
                      const command = `curl -s ${window.location.origin}/${data.file.id} | openssl enc -d -aes-256-cbc -pbkdf2 > "${data.file.name}"`;
                      navigator.clipboard.writeText(command);
                    }}
                  >
                    📋
                  </button>
                </div>
              </div>
            {/if}
          </div>
        </div>
      {:else if downloadURL !== ""}
        <div class="download-section-card rounded-box">
          <div class="download-header">
            <h3>
              <span class="download-icon">📥</span>
              Download Options
            </h3>
            <p class="download-description">
              Your file is ready for download. Use the options below to access your file.
            </p>
          </div>

          <div class="download-form">
            <div class="download-link-section">
              <!-- svelte-ignore a11y_label_has_associated_control -->
              <label class="download-label">
                <span class="label-text">Download URL</span>
                <a href={downloadURL} class="download-link">
                  {decodeURI(downloadURL)}
                </a>
              </label>

              <div class="download-actions">
                <button
                  onclick={() => navigator.clipboard.writeText(downloadURL)}
                  class="copy-button"
                >
                  📋 Copy Link
                </button>
                <a href={downloadURL} class="direct-download-button"> ⬇️ Download File </a>
              </div>
            </div>

            {#if isImage}
              <div class="conversion-options">
                <h4>Image Conversion</h4>
                <div class="conversion-buttons">
                  <a href={convertedPath(downloadURL, "jpg")} class="conversion-button">
                    🖼️ Convert to JPEG
                  </a>
                  <a href={convertedPath(downloadURL, "png")} class="conversion-button">
                    🖼️ Convert to PNG
                  </a>
                </div>
              </div>
            {/if}

            {#if browser}
              <div class="curl-inline">
                <span class="curl-label">Or use command line:</span>
                <div class="curl-container">
                  <code class="curl-command-inline">
                    curl -OJ "{downloadURL}"
                  </code>
                  <button
                    type="button"
                    class="curl-copy-btn"
                    onclick={() => {
                      const command = `curl -OJ "${downloadURL}"`;
                      navigator.clipboard.writeText(command);
                    }}
                  >
                    📋
                  </button>
                </div>
              </div>
            {/if}
          </div>
        </div>
      {/if}
    {/if}
  </section>

  {#if data.file !== null}
    <section class="info-section">
      <div class="info-card rounded-box">
        <h3>
          <span class="info-icon">🔒</span>
          Privacy Policy
        </h3>
        <p>
          When downloading files, we <strong>permanently</strong> store: file ID and your IP address.
        </p>
      </div>
    </section>
  {/if}
</main>

<style>
  .main {
    display: flex;
    flex-direction: column;
    gap: 32px;
  }

  .download-section {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .section-header {
    text-align: center;
    margin-bottom: 16px;
  }

  .section-title {
    margin: 0;
    font-size: 32px;
    font-weight: 700;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
  }

  .section-icon {
    font-size: 36px;
  }

  .folder-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 20px;
    border: none;
    border-radius: 12px;
    background: #667eea;
    color: white;
    font-size: 14px;
    font-weight: 600;
    text-decoration: none;
    flex-shrink: 0;
    box-shadow: 0 4px 16px rgba(102, 126, 234, 0.3);
  }

  .folder-button:hover {
    background: #5a67d8;
    color: white;
  }

  .file-details {
    min-width: 0;
    flex: 1;
  }

  .file-name {
    margin: 0 0 8px 0;
    font-size: 20px;
    font-weight: 600;
    color: #333;
    word-break: break-all;
  }

  .file-type {
    margin: 0;
    color: #666;
    font-size: 14px;
  }

  .encryption-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid rgba(59, 130, 246, 0.2);
    border-radius: 20px;
    font-size: 14px;
    font-weight: 600;
    color: #3b82f6;
  }

  .badge-icon {
    font-size: 16px;
  }

  .decrypt-section {
    padding: 32px;
  }

  .decrypt-header {
    text-align: center;
    margin-bottom: 24px;
  }

  .decrypt-header h3 {
    margin: 0 0 12px 0;
    font-size: 24px;
    font-weight: 600;
    color: #333;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .decrypt-icon {
    font-size: 28px;
  }

  .decrypt-description {
    margin: 0;
    color: #666;
    font-size: 16px;
    line-height: 1.5;
  }

  .passphrase-form {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .passphrase-label {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .label-text {
    font-weight: 600;
    color: #333;
    font-size: 16px;
  }

  .passphrase-input {
    width: 100%;
    padding: 16px;
    border: 2px solid rgba(102, 126, 234, 0.2);
    border-radius: 12px;
    font-size: 16px;
    background: rgba(255, 255, 255, 0.9);
    transition: all 0.3s ease;
  }

  .passphrase-input:focus {
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    outline: none;
  }

  .download-controls {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .download-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 16px 32px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 12px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 4px 16px rgba(102, 126, 234, 0.3);
  }

  .download-button:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 24px rgba(102, 126, 234, 0.4);
  }

  .download-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  .button-icon {
    font-size: 20px;
  }

  .status-indicator {
    padding: 12px 16px;
    border-radius: 8px;
    font-weight: 500;
    text-align: center;
  }

  .status-indicator.progress {
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid rgba(59, 130, 246, 0.2);
    color: #3b82f6;
  }

  .status-indicator.success {
    background: rgba(34, 197, 94, 0.1);
    border: 1px solid rgba(34, 197, 94, 0.2);
    color: #22c55e;
  }

  .status-indicator.error {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }

  .download-link-section {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .download-label {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .download-label .label-text {
    font-weight: 600;
    color: #333;
    font-size: 16px;
  }

  .download-link {
    word-break: break-all;
    color: #667eea;
    text-decoration: none;
    font-weight: 500;
    padding: 16px;
    background: rgba(102, 126, 234, 0.1);
    border: 1px solid rgba(102, 126, 234, 0.2);
    border-radius: 12px;
    transition: all 0.3s ease;
    display: block;
    font-size: 16px;
    line-height: 1.4;
  }

  .download-link:hover {
    background: rgba(102, 126, 234, 0.2);
    text-decoration: underline;
  }

  .download-actions {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }

  .copy-button,
  .direct-download-button {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 20px;
    border: none;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    text-decoration: none;
    transition: all 0.3s ease;
    flex: 1;
    justify-content: center;
    min-width: 140px;
  }

  .copy-button {
    background: #667eea;
    color: white;
  }

  .copy-button:hover,
  .direct-download-button:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }

  .conversion-button {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: rgba(102, 126, 234, 0.1);
    color: #667eea;
    text-decoration: none;
    border: 1px solid rgba(102, 126, 234, 0.2);
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.3s ease;
    flex: 1;
    justify-content: center;
    min-width: 120px;
  }

  .conversion-button:hover {
    background: #667eea;
    color: white;
    transform: translateY(-1px);
  }

  .curl-inline {
    margin-top: 24px;
    margin-bottom: 0;
    padding: 12px;
    background: rgba(102, 126, 234, 0.05);
    border: 1px solid rgba(102, 126, 234, 0.15);
    border-radius: 8px;
  }

  .info-card {
    text-align: center;
    padding: 24px;
  }

  @media (max-width: 768px) {
    .section-header {
      margin-bottom: 0;
    }

    .section-title {
      font-size: 28px;
      flex-direction: column;
      gap: 8px;
    }

    .decrypt-section {
      padding: 24px;
    }

    .download-actions {
      flex-direction: column;
    }

    .copy-button,
    .direct-download-button {
      min-width: unset;
    }

    .curl-inline {
      display: none;
    }

    .conversion-button {
      min-width: unset;
    }
  }

  @media (max-width: 480px) {
    .section-title {
      font-size: 24px;
    }

    .file-name {
      font-size: 18px;
    }

    .decrypt-header h3 {
      font-size: 20px;
      flex-direction: column;
      gap: 4px;
    }

    .download-button {
      padding: 14px 24px;
    }
  }
</style>
