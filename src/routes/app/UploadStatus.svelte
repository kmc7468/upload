<script lang="ts">
  import FolderNameEditor from "$lib/components/FolderNameEditor.svelte";
  import QRCode from "qrcode";
  import CaretDown from "phosphor-svelte/lib/CaretDownIcon";
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
        <span class="progress-text">{status.percent}% · {status.throughput}</span>
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
            <Button variant="secondary" icon={Image} href={convertedPath(realDownloadURL, "jpg")}>
              Convert to JPEG
            </Button>
            <Button variant="secondary" icon={Image} href={convertedPath(realDownloadURL, "png")}>
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
          <summary>
            <QrCode weight="bold" />QR Code<CaretDown weight="bold" class="icon caret" />
          </summary>
          <div class="qr-container">
            <img src={qrcode} alt="QR code for download link" class="qr-image" />
            <p class="qr-description">Scan to download on a mobile device</p>
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
    align-items: flex-start;
    gap: 12px;
    padding: 16px 20px;
    border: 1px solid transparent;
    border-radius: var(--radius-lg);
  }

  .progress {
    background: var(--color-accent-subtle);
    border-color: var(--color-accent-border);
    --status-color: var(--color-accent-text);
  }

  .success {
    background: var(--color-success-subtle);
    border-color: var(--color-success-border);
    --status-color: var(--color-success);
  }

  .error {
    background: var(--color-danger-subtle);
    border-color: var(--color-danger-border);
    --status-color: var(--color-danger-text);
  }

  /* As tall as the heading's line, so the two stay centered on each other. */
  .status-icon {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    height: 24px;
    font-size: 20px;
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
    font-size: var(--text-base);
    font-weight: 600;
    line-height: 24px;
    color: var(--color-text);
  }

  /* The heading sits closer to its own text than the parts below sit to each other. */
  .status-content h4 + p,
  .status-content h4 + .progress-info {
    margin-top: -8px;
  }

  .status-content p {
    margin: 0;
    font-size: var(--text-md);
    color: var(--color-text-secondary);
    line-height: 1.6;
  }

  .progress-info {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .progress-text {
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--color-text-secondary);
    font-variant-numeric: tabular-nums;
  }

  .progress-bar {
    width: 100%;
    height: 6px;
    background: var(--color-accent-border);
    border-radius: var(--radius-pill);
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--color-accent);
    border-radius: var(--radius-pill);
    transition: width 0.3s ease;
  }

  .download-section {
    display: flex;
    flex-direction: column;
  }

  /* On the tinted card, the link and the QR code sit on plain surfaces. */
  .download-link {
    margin-bottom: 12px;
    background: var(--color-control);
  }

  .download-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .qr-section {
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-control);
  }

  .qr-section summary {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 36px;
    padding: 7px 14px;
    border-radius: var(--radius-md);
    font-size: var(--text-md);
    font-weight: 500;
    color: var(--color-text);
    list-style: none;
    cursor: pointer;
    transition: background var(--transition);
  }

  .qr-section summary::-webkit-details-marker {
    display: none;
  }

  .qr-section summary :global(.caret) {
    margin-left: auto;
    color: var(--color-text-muted);
    transition: transform var(--transition);
  }

  .qr-section[open] summary :global(.caret) {
    transform: rotate(180deg);
  }

  .qr-section summary:hover {
    background: var(--color-surface-hover);
  }

  .qr-section[open] summary {
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
  }

  .qr-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 16px;
    border-top: 1px solid var(--color-border);
    text-align: center;
  }

  /* The code keeps its white margin in the dark theme, so scanners can read it. */
  .qr-image {
    border-radius: var(--radius-md);
  }

  .qr-description {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }

  @media (max-width: 768px) {
    .status-card {
      padding: 16px;
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
