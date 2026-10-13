<script lang="ts">
  import FileSaver from "file-saver";
  import { onMount, tick } from "svelte";
  import { browser } from "$app/environment";
  import Download from "phosphor-svelte/lib/DownloadSimpleIcon";
  import FileText from "phosphor-svelte/lib/FileTextIcon";
  import Folder from "phosphor-svelte/lib/FolderIcon";
  import Image from "phosphor-svelte/lib/ImageIcon";
  import Lock from "phosphor-svelte/lib/LockIcon";
  import LockOpen from "phosphor-svelte/lib/LockOpenIcon";
  import Save from "phosphor-svelte/lib/FloppyDiskIcon";
  import ShieldCheck from "phosphor-svelte/lib/ShieldCheckIcon";
  import { decryptOpenSSL } from "$lib/cipher";
  import Button from "$lib/components/Button.svelte";
  import Card from "$lib/components/Card.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import CommandLine from "$lib/components/CommandLine.svelte";
  import CopyButton from "$lib/components/CopyButton.svelte";
  import NotFound from "$lib/components/NotFound.svelte";
  import StatusMessage from "$lib/components/StatusMessage.svelte";
  import { getUploadedFiles } from "$lib/storage";
  import { throughputMeter, transfer } from "$lib/transfer";
  import { convertedPath, downloadPath, folderPagePath, passphraseFromHash } from "$lib/urls";
  import { formatDateTime, formatExpiry, formatSize, formatThroughput } from "$lib/utils";
  import { clock } from "$lib/clock.svelte";
  import PasswordInput from "$lib/components/PasswordInput.svelte";

  import "$lib/style.css";

  let { data } = $props();

  const isImage = $derived(data.file?.contentType.startsWith("image/") ?? false);

  let downloadURL = $state("");
  let status = $state<{ tone: "progress" | "success" | "error"; message: string }>();
  let passphrase = $state("");

  const downloadEncryptedFile = async () => {
    const meter = throughputMeter();
    const xhr = await transfer("GET", downloadURL, {
      responseType: "arraybuffer",
      onProgress: (loaded, total) => {
        const percent = Math.round((loaded / total) * 100);
        status = {
          tone: "progress",
          message: `Downloading the encrypted file... (${percent}%, ${formatThroughput(meter(loaded))})`,
        };
      },
    });
    if (xhr.status !== 200) {
      throw new Error("Download failed");
    }

    return xhr.response as ArrayBuffer;
  };

  const decryptFile = async (encryptedFile: ArrayBuffer) => {
    status = { tone: "progress", message: "Decrypting the file..." };
    const file = await decryptOpenSSL(encryptedFile, passphrase);
    status = { tone: "success", message: "The file has been decrypted." };
    return file;
  };

  let isDownloading = $state(false);
  let encryptedFile: ArrayBuffer | undefined = $state.raw();
  let file: Blob | undefined = $state();

  // The button moves through download, decrypt and save as each step succeeds.
  const stage = $derived(
    !encryptedFile
      ? { label: "Decrypt & Download", icon: Download }
      : !file
        ? { label: "Decrypt", icon: LockOpen }
        : { label: "Save File", icon: Save },
  );

  const downloadAndDecryptFile = async () => {
    if (!encryptedFile) {
      try {
        isDownloading = true;
        encryptedFile = await downloadEncryptedFile();
      } catch {
        status = {
          tone: "error",
          message: "Could not download the encrypted file. It may have expired.",
        };
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
        status = {
          tone: "error",
          message: "Could not decrypt the file. Your passphrase may be incorrect.",
        };
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

<main class="page">
  <PageHeader icon={Download} title="Download File" />

  {#if data.file === null}
    <NotFound title="File Not Found" message="The requested file does not exist or has expired." />
  {:else}
    <section class="card file-info-card">
      <span class="file-icon"><FileText /></span>
      <div class="file-details">
        <h3 class="file-name">{data.file.name}</h3>
        <div class="meta-row">
          <p class="meta-list">
            <span>{formatSize(data.file.size)}</span>
            {#if !data.file.isEncrypted}<span>{data.file.contentType}</span>{/if}
            <span title={formatDateTime(data.file.expireAt)}>
              {formatExpiry(data.file.expireAt, clock.now)}
            </span>
          </p>
          {#if data.file.isEncrypted}
            <span class="badge"><Lock />End-to-End Encrypted</span>
          {/if}
        </div>
      </div>
      {#if data.file.folderId}
        <Button href={folderPagePath(data.file.folderId)} icon={Folder}>Open Folder</Button>
      {/if}
    </section>

    {#if data.file.isEncrypted}
      <Card
        icon={LockOpen}
        title="Decrypt File"
        description="This file is encrypted. Enter the passphrase to download and decrypt it."
      >
        <div class="download-form">
          <div>
            <label class="field-label" for="passphrase">Passphrase</label>
            <PasswordInput
              id="passphrase"
              disabled={isDownloading || !!file}
              bind:value={passphrase}
              placeholder="Enter the passphrase"
              onkeydown={async (event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  await downloadAndDecryptFile();
                }
              }}
            />
          </div>

          {#if passphrase !== ""}
            <Button
              variant="primary"
              block
              icon={stage.icon}
              disabled={isDownloading}
              onclick={downloadAndDecryptFile}
            >
              {stage.label}
            </Button>

            {#if status}
              <StatusMessage tone={status.tone}>{status.message}</StatusMessage>
            {/if}
          {/if}

          {#if browser}
            <CommandLine
              command={`curl -s ${window.location.origin}/${data.file.id} | openssl enc -d -aes-256-cbc -pbkdf2 > "${data.file.name}"`}
            />
          {/if}
        </div>
      </Card>
    {:else if downloadURL !== ""}
      <Card
        icon={Download}
        title="Download Options"
        description="Download the file, or copy its link to share it."
      >
        <div class="download-form">
          <div>
            <span class="field-label">Download URL</span>
            <a href={downloadURL} class="download-link">{decodeURI(downloadURL)}</a>
          </div>

          <div class="download-actions">
            <CopyButton text={downloadURL} />
            <Button variant="primary" href={downloadURL} icon={Download}>Download File</Button>
          </div>

          {#if isImage}
            <div class="conversion-options">
              <h4>Image Conversion</h4>
              <div class="conversion-buttons">
                <Button variant="subtle" href={convertedPath(downloadURL, "jpg")} icon={Image}>
                  Convert to JPEG
                </Button>
                <Button variant="subtle" href={convertedPath(downloadURL, "png")} icon={Image}>
                  Convert to PNG
                </Button>
              </div>
            </div>
          {/if}

          {#if browser}
            <CommandLine command={`curl -OJ "${downloadURL}"`} />
          {/if}
        </div>
      </Card>
    {/if}
  {/if}

  {#if data.file !== null}
    <section class="info-section">
      <Card icon={ShieldCheck} title="Privacy Policy">
        <p class="info-text">
          When downloading files, we <strong>permanently</strong> store: file ID and your IP address.
        </p>
      </Card>
    </section>
  {/if}
</main>

<style>
  .file-details {
    min-width: 0;
    flex: 1;
  }

  .file-name {
    margin: 0 0 4px 0;
    font-size: var(--text-xl);
    font-weight: 600;
    color: var(--color-text);
    word-break: break-all;
  }

  .info-text {
    margin: 0;
    color: var(--color-text-secondary);
  }

  @media (max-width: 480px) {
    .file-name {
      font-size: var(--text-lg);
    }
  }
</style>
