<script lang="ts">
  import QRCode from "qrcode";
  import { goto } from "$app/navigation";
  import { encodeStringInBase64 } from "$lib/cipher";
  import { formatThroughput } from "$lib/utils";

  type Status =
    | {
        status: "encrypting";
      }
    | {
        status: "uploading";
        percent: number;
        throughput: string;
      }
    | {
        status: "uploaded";
        downloadURL: string;
        isImage: boolean;
        passphrase: string | null;
      }
    | {
        status: "failed";
      };

  let status: Status | undefined = $state();
  let isPassphraseIncluded = $state(true);

  let realDownloadURL: string | undefined = $derived(
    isPassphraseIncluded && status?.status === "uploaded" && status.passphrase
      ? `${status.downloadURL}#${encodeStringInBase64(status.passphrase)}`
      : status?.status === "uploaded"
      ? status.downloadURL
      : undefined
  );

  const updateExtension = (downloadURL: string, newExtension: string) => {
    const url = new URL(downloadURL);
    const pathname = url.pathname;
    const hasExtension = pathname.match(/\.[a-zA-Z0-9%_-]+$/);

    if (!hasExtension) {
      return downloadURL + newExtension;
    } else {
      return downloadURL.replace(/\.[a-zA-Z0-9%_-]+$/, newExtension);
    }
  };

  export const displayEncrypting = () => {
    status = {
      status: "encrypting",
    };
  };
  export const updateUploadProgress = (newPercent: number, newThroughput: number) => {
    status = {
      status: "uploading",
      percent: newPercent,
      throughput: formatThroughput(newThroughput),
    };
  };
  export const updateDownloadURL = (newDownloadURL: string, newPassphrase: string | null, newIsImage: boolean) => {
    status = {
      status: "uploaded",
      downloadURL: newDownloadURL,
      isImage: newIsImage,
      passphrase: newPassphrase,
    };
  };
  export const displayFailure = () => {
    status = {
      status: "failed",
    };
  };
  export const reset = () => {
    status = undefined;
  };
</script>

{#if status?.status === "encrypting"}
  <div class="status-card encrypting">
    <div class="status-icon">🔐</div>
    <div class="status-content">
      <h4>Encrypting File</h4>
      <p>Securing your file with end-to-end encryption...</p>
    </div>
  </div>
{:else if status?.status === "uploading"}
  <div class="status-card uploading">
    <div class="status-icon">⬆️</div>
    <div class="status-content">
      <h4>Uploading File</h4>
      <div class="progress-info">
        <span class="progress-text">{status.percent}% • {status.throughput}</span>
        <div class="progress-bar">
          <div class="progress-fill" style="width: {status.percent}%"></div>
        </div>
      </div>
    </div>
  </div>
{:else if status?.status === "uploaded" && realDownloadURL}
  <div class="status-card uploaded">
    <div class="status-icon">✅</div>
    <div class="status-content">
      <h4>Upload Complete!</h4>
      
      <div class="download-section">
        <div class="download-label">Download URL:</div>
        <a id="download" href={realDownloadURL} class="download-link">
          {decodeURI(realDownloadURL)}
        </a>
        
        <div class="download-actions">
          <button type="button" onclick={() => navigator.clipboard.writeText(realDownloadURL)} class="copy-button">
            📋 Copy Link
          </button>
          
          {#if status.isImage && !status.passphrase}
            <button type="button" onclick={() => goto(`${updateExtension(realDownloadURL, ".jpg")}?jpg`)} class="utility-button">
              🖼️ Convert to JPEG
            </button>
            <button type="button" onclick={() => goto(`${updateExtension(realDownloadURL, ".png")}?png`)} class="utility-button">
              🖼️ Convert to PNG
            </button>
          {/if}
        </div>
      </div>

      {#if status.passphrase}
        <div class="passphrase-option">
          <label class="checkbox-label">
            <input type="checkbox" bind:checked={isPassphraseIncluded}>
            <span>Include passphrase in URL and QR code</span>
          </label>
        </div>
      {/if}

      {#await QRCode.toDataURL(realDownloadURL, { margin: 2, width: 200 }) then qrcode}
        <details class="qr-section">
          <summary>QR Code</summary>
          <div class="qr-container">
            <img src={qrcode} alt="QR code for download link" class="qr-image" />
            <p class="qr-description">Scan to download on mobile device</p>
          </div>
        </details>
      {/await}
    </div>
  </div>
{:else if status?.status === "failed"}
  <div class="status-card failed">
    <div class="status-icon">❌</div>
    <div class="status-content">
      <h4>Upload Failed</h4>
      <p>An error occurred while uploading your file. Please try again.</p>
    </div>
  </div>
{/if}

<style>
  .status-card {
    display: flex;
    gap: 16px;
    padding: 24px;
    border-radius: 16px;
    margin-top: 16px;
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    transition: all 0.3s ease;
    align-items: flex-start;
  }

  .encrypting {
    background: rgba(34, 197, 94, 0.1);
    border-color: rgba(34, 197, 94, 0.3);
  }

  .uploading {
    background: rgba(59, 130, 246, 0.1);
    border-color: rgba(59, 130, 246, 0.3);
  }

  .uploaded {
    background: rgba(34, 197, 94, 0.1);
    border-color: rgba(34, 197, 94, 0.3);
  }

  .failed {
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.3);
  }

  .status-icon {
    font-size: 32px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.1);
  }

  .status-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .status-content h4 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: #333;
  }

  .status-content p {
    margin: 0;
    color: #666;
    line-height: 1.5;
  }

  .progress-info {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .progress-text {
    font-size: 14px;
    font-weight: 600;
    color: #3b82f6;
  }

  .progress-bar {
    width: 100%;
    height: 8px;
    background: rgba(59, 130, 246, 0.2);
    border-radius: 4px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #3b82f6, #1d4ed8);
    border-radius: 4px;
    transition: width 0.3s ease;
  }

  .download-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .download-label {
    font-weight: 600;
    color: #333;
    font-size: 14px;
  }

  .download-link {
    word-break: break-all;
    color: #667eea;
    text-decoration: none;
    font-weight: 500;
    padding: 12px 16px;
    background: rgba(102, 126, 234, 0.1);
    border: 1px solid rgba(102, 126, 234, 0.2);
    border-radius: 8px;
    transition: all 0.3s ease;
  }

  .download-link:hover {
    background: rgba(102, 126, 234, 0.2);
    text-decoration: underline;
  }

  .download-actions {
    display: flex;
    gap: 8px;
  }

  .copy-button {
    padding: 8px 16px;
    font-size: 14px;
    background: #667eea;
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
    transition: all 0.3s ease;
  }

  .copy-button:hover {
    background: #5a67d8;
    transform: translateY(-1px);
  }

  .passphrase-option {
    padding: 16px;
    background: rgba(59, 130, 246, 0.05);
    border: 1px solid rgba(59, 130, 246, 0.1);
    border-radius: 8px;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-size: 14px;
    color: #333;
  }

  .checkbox-label input[type="checkbox"] {
    margin: 0;
  }

  .qr-section {
    border: 1px solid rgba(102, 126, 234, 0.2);
    border-radius: 8px;
    background: rgba(102, 126, 234, 0.05);
  }

  .qr-section summary {
    padding: 12px 16px;
    cursor: pointer;
    font-weight: 600;
    color: #333;
    border-radius: 8px;
    transition: background-color 0.3s ease;
  }

  .qr-section summary:hover {
    background: rgba(102, 126, 234, 0.1);
  }

  .utility-button {
    padding: 8px 16px;
    font-size: 14px;
    background: #667eea;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 600;
    transition: all 0.3s ease;
  }

  .utility-button:hover {
    background: #5a67d8;
    transform: translateY(-1px);
  }

  .qr-container {
    padding: 16px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .qr-image {
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .qr-description {
    margin: 0;
    font-size: 13px;
    color: #666;
  }

  @media (max-width: 768px) {
    .status-card {
      padding: 16px;
      gap: 12px;
      flex-direction: column;
    }

    .status-icon {
      font-size: 24px;
      width: 40px;
      height: 40px;
      align-self: flex-start;
    }

    .status-content h4 {
      font-size: 16px;
    }

    .download-section {
      gap: 8px;
    }

    .download-label {
      font-size: 13px;
      text-align: left;
    }

    .download-link {
      font-size: 12px;
      padding: 8px 12px;
      text-align: left;
      line-height: 1.4;
    }

    .download-actions {
      flex-direction: column;
      gap: 6px;
    }

    .copy-button, .utility-button {
      font-size: 13px;
      padding: 8px 12px;
    }

    .qr-container {
      padding: 12px;
      text-align: center;
    }

    .qr-image {
      align-self: center;
    }

    .qr-description {
      text-align: center;
      font-size: 12px;
    }
  }

  @media (max-width: 480px) {
    .status-card {
      padding: 12px;
      gap: 8px;
    }

    .status-icon {
      font-size: 20px;
      width: 32px;
      height: 32px;
    }

    .status-content {
      width: 100%;
    }

    .qr-section summary {
      padding: 8px 12px;
      font-size: 14px;
    }

    .qr-container {
      padding: 8px;
      align-items: center;
    }

    .qr-image {
      width: 150px;
      height: 150px;
    }
  }
</style>