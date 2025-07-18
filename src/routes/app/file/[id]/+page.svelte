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

<svelte:head>
  <title>{data.file === null ? "File not found - Minchan's Upload" : `${data.file.name} - Minchan's Upload`}</title>
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
            <p class="file-type">Content Type: <code>{data.file.contentType}</code></p>
          {/if}
          {#if data.file.isEncrypted}
            <div class="encryption-badge">
              <span class="badge-icon">🔐</span>
              <span>End-to-End Encrypted</span>
            </div>
          {/if}
        </div>
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
                onkeydown={async event => {
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
                  <div class="status-indicator {downloadStatus.startsWith('Failed') ? 'error' : downloadStatus.startsWith('Succeeded') ? 'success' : 'progress'}">
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
                    curl -s {window.location.origin}/{data.file.id} | openssl enc -d -aes-256-cbc -pbkdf2 &gt; "{data.file.name}"
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
                <button onclick={() => navigator.clipboard.writeText(downloadURL)} class="copy-button">
                  📋 Copy Link
                </button>
                <a href={downloadURL} class="direct-download-button">
                  ⬇️ Download File
                </a>
              </div>
            </div>

            {#if isImage}
              <div class="conversion-options">
                <h4>Image Conversion</h4>
                <div class="conversion-buttons">
                  <a href={`${downloadURL}?jpg`} class="conversion-button">
                    🖼️ Convert to JPEG
                  </a>
                  <a href={`${downloadURL}?png`} class="conversion-button">
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
                    curl -O "{window.location.origin}/{data.file.id}/{data.file.name}"
                  </code>
                  <button 
                    type="button"
                    class="curl-copy-btn"
                    onclick={() => {
                      const command = `curl -O "${window.location.origin}/${data.file.id}/${data.file.name}"`;
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
    margin: 0 0 8px 0;
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

  .error-card {
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 32px;
    background: rgba(254, 242, 242, 0.9);
    border: 2px solid rgba(239, 68, 68, 0.2);
    backdrop-filter: blur(10px);
  }

  .error-icon {
    font-size: 48px;
    flex-shrink: 0;
    color: #dc2626;
  }

  .error-content h3 {
    margin: 0 0 8px 0;
    color: #991b1b;
    font-size: 24px;
    font-weight: 700;
  }

  .error-content p {
    margin: 0;
    color: #7c2d12;
    font-size: 16px;
    line-height: 1.5;
    font-weight: 500;
  }

  .file-info-card {
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 24px;
  }

  .file-icon {
    font-size: 48px;
    flex-shrink: 0;
    opacity: 0.8;
  }

  .file-details {
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

  .download-section-card {
    padding: 32px;
  }

  .download-header {
    text-align: center;
    margin-bottom: 24px;
  }

  .download-header h3 {
    margin: 0 0 12px 0;
    font-size: 24px;
    font-weight: 600;
    color: #333;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .download-description {
    margin: 0;
    color: #666;
    font-size: 16px;
    line-height: 1.5;
  }

  .download-icon {
    font-size: 28px;
  }

  .download-form {
    display: flex;
    flex-direction: column;
    gap: 20px;
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

  .direct-download-button {
    background: #22c55e;
    color: white;
  }

  .copy-button:hover,
  .direct-download-button:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }

  .conversion-options {
    padding: 20px;
    background: rgba(102, 126, 234, 0.05);
    border: 1px solid rgba(102, 126, 234, 0.15);
    border-radius: 12px;
  }

  .conversion-options h4 {
    margin: 0 0 12px 0;
    font-size: 16px;
    font-weight: 600;
    color: #333;
  }

  .conversion-buttons {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
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

  .curl-label {
    display: block;
    font-size: 13px;
    color: #666;
    margin-bottom: 8px;
    font-weight: 500;
  }

  .curl-container {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .curl-command-inline {
    flex: 1;
    display: block;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 8px 12px;
    font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
    font-size: 12px;
    line-height: 1.4;
    overflow-x: auto;
    white-space: nowrap;
    color: #374151;
  }

  .curl-copy-btn {
    flex-shrink: 0;
    padding: 8px 10px;
    background: #667eea;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .curl-copy-btn:hover {
    background: #5a67d8;
    transform: translateY(-1px);
  }

  .info-section {
    margin-top: 24px;
  }

  .info-section {
    margin-top: 24px;
  }

  .info-card {
    text-align: center;
    padding: 24px;
  }

  .info-card h3 {
    margin: 0 0 12px 0;
    color: #333;
    font-size: 18px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .info-icon {
    font-size: 24px;
  }

  .info-card p {
    margin: 0;
    color: #666;
    line-height: 1.6;
  }

  @media (max-width: 768px) {
    .main {
      gap: 32px;
    }

    .section-header {
      margin-bottom: 0;
    }

    .section-title {
      font-size: 28px;
      flex-direction: column;
      gap: 8px;
    }

    .file-info-card {
      flex-direction: column;
      text-align: center;
      gap: 16px;
    }

    .decrypt-section {
      padding: 24px;
    }

    .download-section-card {
      padding: 24px;
    }

    .download-header h3 {
      font-size: 20px;
      flex-direction: column;
      gap: 4px;
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

    .conversion-buttons {
      flex-direction: column;
    }

    .conversion-button {
      min-width: unset;
    }
  }

  @media (max-width: 480px) {
    .section-title {
      font-size: 24px;
    }

    .error-card {
      flex-direction: column;
      text-align: center;
      padding: 24px;
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