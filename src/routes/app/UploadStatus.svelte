<script lang="ts">
  import FolderNameEditor from "$lib/components/FolderNameEditor.svelte";
  import QRCode from "qrcode";
  import { goto } from "$app/navigation";
  import CircleCheck from "phosphor-svelte/lib/CheckCircleIcon";
  import CircleX from "phosphor-svelte/lib/XCircleIcon";
  import Image from "phosphor-svelte/lib/ImageIcon";
  import Lock from "phosphor-svelte/lib/LockIcon";
  import QrCode from "phosphor-svelte/lib/QrCodeIcon";
  import Upload from "phosphor-svelte/lib/UploadSimpleIcon";
  import Button from "$lib/components/Button.svelte";
  import CopyButton from "$lib/components/CopyButton.svelte";
  import { convertedPath, withPassphrase } from "$lib/urls";
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
        folder?: { id: string; name: string; managementToken: string };
        isImage: boolean;
        passphrase: string | null;
      }
    | {
        status: "failed";
        message: string;
      };

  let status: Status | undefined = $state();
  let isPassphraseIncluded = $state(true);

  let realDownloadURL: string | undefined = $derived(
    isPassphraseIncluded && status?.status === "uploaded" && status.passphrase
      ? withPassphrase(status.downloadURL, status.passphrase)
      : status?.status === "uploaded"
        ? status.downloadURL
        : undefined,
  );

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
  export const updateDownloadURL = (
    newDownloadURL: string,
    newPassphrase: string | null,
    newIsImage: boolean,
    folder?: { id: string; name: string; managementToken: string },
  ) => {
    status = {
      status: "uploaded",
      folder,
      downloadURL: newDownloadURL,
      isImage: newIsImage,
      passphrase: newPassphrase,
    };
  };
  export const displayFailure = (message = "Could not upload the file. Please try again.") => {
    status = {
      status: "failed",
      message,
    };
  };
  export const reset = () => {
    status = undefined;
  };
</script>

{#if status?.status === "encrypting"}
  <div class="status-card progress" role="status">
    <span class="status-icon"><Lock /></span>
    <div class="status-content">
      <h4>Encrypting File</h4>
      <p>Securing your file with end-to-end encryption...</p>
    </div>
  </div>
{:else if status?.status === "uploading"}
  <div class="status-card progress">
    <span class="status-icon"><Upload /></span>
    <div class="status-content">
      <h4>Uploading File</h4>
      <div class="progress-info">
        <span class="progress-text">{status.percent}% • {status.throughput}</span>
        <div
          class="progress-bar"
          role="progressbar"
          aria-label="Upload progress"
          aria-valuenow={status.percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div class="progress-fill" style="width: {status.percent}%"></div>
        </div>
      </div>
    </div>
  </div>
{:else if status?.status === "uploaded" && realDownloadURL}
  <div class="status-card success" role="status">
    <span class="status-icon"><CircleCheck /></span>
    <div class="status-content">
      <h4>Upload Complete</h4>

      {#if status.folder}
        <FolderNameEditor
          {...status.folder}
          expanded
          onsave={(name) => {
            if (status?.status === "uploaded" && status.folder) status.folder.name = name;
          }}
        />
      {/if}
      <div class="download-section">
        <span class="field-label">Download URL</span>
        <a id="download" href={realDownloadURL} class="download-link">
          {decodeURI(realDownloadURL)}
        </a>

        <div class="download-actions">
          <CopyButton text={realDownloadURL} variant="primary" />

          {#if status.isImage && !status.passphrase}
            <Button
              variant="subtle"
              icon={Image}
              onclick={() => goto(convertedPath(realDownloadURL, "jpg"))}
            >
              Convert to JPEG
            </Button>
            <Button
              variant="subtle"
              icon={Image}
              onclick={() => goto(convertedPath(realDownloadURL, "png"))}
            >
              Convert to PNG
            </Button>
          {/if}
        </div>
      </div>

      {#if status.passphrase}
        <label class="checkbox-label">
          <input type="checkbox" bind:checked={isPassphraseIncluded} />
          <span>Include passphrase in URL and QR code</span>
        </label>
      {/if}

      {#await QRCode.toDataURL(realDownloadURL, { margin: 2, width: 200 }) then qrcode}
        <details class="qr-section">
          <summary><QrCode weight="bold" />QR Code</summary>
          <div class="qr-container">
            <img src={qrcode} alt="QR code for download link" class="qr-image" />
            <p class="qr-description">Scan to download on mobile device</p>
          </div>
        </details>
      {/await}
    </div>
  </div>
{:else if status?.status === "failed"}
  <div class="status-card error" role="status">
    <span class="status-icon"><CircleX /></span>
    <div class="status-content">
      <h4>Upload Failed</h4>
      <p>{status.message}</p>
    </div>
  </div>
{/if}

<style>
  .status-card {
    display: flex;
    gap: 16px;
    padding: 24px;
    border: 1px solid transparent;
    border-radius: var(--radius-lg);
    margin-top: 16px;
    align-items: flex-start;
  }

  .progress {
    background: var(--color-brand-faint);
    border-color: var(--color-brand-border);
    --status-color: var(--color-brand);
  }

  .success {
    background: var(--color-success-subtle);
    border-color: var(--color-success-border);
    --status-color: var(--color-success);
  }

  .error {
    background: var(--color-danger-subtle);
    border-color: var(--color-danger-border);
    --status-color: var(--color-danger);
  }

  .status-icon {
    display: flex;
    flex-shrink: 0;
    font-size: 28px;
    line-height: 1;
    color: var(--status-color);
  }

  .status-content {
    min-width: 0;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .status-content h4 {
    margin: 0;
    font-size: var(--text-lg);
    font-weight: 600;
    line-height: 32px;
    color: var(--color-text);
  }

  .status-content p {
    margin: 0;
    color: var(--color-text-secondary);
    line-height: 1.5;
  }

  .progress-info {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .progress-text {
    font-size: var(--text-md);
    font-weight: 600;
    color: var(--color-brand-strong);
  }

  .progress-bar {
    width: 100%;
    height: 8px;
    background: var(--color-brand-border);
    border-radius: var(--radius-pill);
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--gradient-brand);
    border-radius: var(--radius-pill);
    transition: width 0.3s ease;
  }

  .download-section {
    display: flex;
    flex-direction: column;
  }

  .download-link {
    margin-bottom: 12px;
  }

  .download-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .qr-section {
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: var(--color-surface-solid);
  }

  .qr-section summary {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    cursor: pointer;
    font-weight: 600;
    color: var(--color-text);
    border-radius: var(--radius-sm);
    transition: background-color var(--transition);
  }

  .qr-section summary:hover {
    background: var(--color-brand-faint);
  }

  .qr-section summary :global(svg) {
    color: var(--color-brand);
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
    border-radius: var(--radius-sm);
    box-shadow: var(--shadow-sm);
  }

  .qr-description {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }

  @media (max-width: 768px) {
    .status-card {
      padding: 16px;
      gap: 12px;
    }

    .status-icon {
      font-size: var(--text-2xl);
    }

    .status-content h4 {
      font-size: var(--text-base);
      line-height: 28px;
    }

    .download-link {
      font-size: var(--text-xs);
      padding: 8px 12px;
      line-height: 1.4;
    }

    .download-actions {
      flex-direction: column;
    }
  }

  @media (max-width: 480px) {
    .qr-image {
      width: 150px;
      height: 150px;
    }
  }
</style>
