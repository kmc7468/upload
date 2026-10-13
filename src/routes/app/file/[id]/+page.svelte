<script lang="ts">
  import FileSaver from "file-saver";
  import { onMount, tick } from "svelte";
  import { page } from "$app/state";
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
  import StatusMessage from "$lib/components/StatusMessage.svelte";
  import { shellQuote } from "$lib/shell";
  import { getUploadedFiles } from "$lib/storage";
  import { throughputMeter, transfer } from "$lib/transfer";
  import { convertedPath, downloadPath, folderPagePath, passphraseFromHash } from "$lib/urls";
  import { formatDateTime, formatExpiry, formatSize, formatThroughput } from "$lib/utils";
  import { clock } from "$lib/clock.svelte";
  import PasswordInput from "$lib/components/PasswordInput.svelte";

  let { data } = $props();

  const isImage = $derived(data.file.contentType.startsWith("image/"));

  // Built from the server's address, so the link is in the page from the first paint.
  const downloadURL = $derived(`${page.url.origin}${downloadPath(data.file.id, data.file.name)}`);
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

    FileSaver.saveAs(file, data.file.name);
  };

  onMount(async () => {
    if (!data.file.isEncrypted) return;

    const fromURL = !!window.location.hash;
    try {
      passphrase = fromURL
        ? passphraseFromHash(window.location.hash)
        : getUploadedFiles().find(
            (stored) =>
              !stored.isExpired &&
              (data.file.folderId
                ? stored.kind === "folder" && stored.id === data.file.folderId
                : stored.kind !== "folder" && stored.id === data.file.id),
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
  <title>{data.file.name} - Minchan's Upload</title>
</svelte:head>

<div class="page">
  <PageHeader title="Download File" />

  <section class="card file-info-card">
    <span class="tile lg"
      >{#if isImage}<Image />{:else}<FileText />{/if}</span
    >
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
          <span class="badge"><Lock />Encrypted</span>
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
      </div>
    </Card>

    <CommandLine
      command={`curl -s ${shellQuote(`${page.url.origin}/${data.file.id}`)} | openssl enc -d -aes-256-cbc -pbkdf2 > ${shellQuote(data.file.name)}`}
    />
  {:else}
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
      </div>

      {#if isImage}
        <div class="card-section">
          <h4 class="section-label">Image Conversion</h4>
          <div class="conversion-buttons">
            <Button href={convertedPath(downloadURL, "jpg")} icon={Image}>Convert to JPEG</Button>
            <Button href={convertedPath(downloadURL, "png")} icon={Image}>Convert to PNG</Button>
          </div>
        </div>
      {/if}
    </Card>

    <CommandLine command={`curl -OJ ${shellQuote(`${page.url.origin}/${data.file.id}`)}`} />
  {/if}

  <section class="info-section">
    <div>
      <h3><ShieldCheck />Privacy Policy</h3>
      <p>
        When downloading files, we <strong>permanently</strong> store: file ID and your IP address.
      </p>
    </div>
  </section>
</div>
