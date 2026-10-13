<script lang="ts">
  import { writable } from "svelte/store";
  import { browser } from "$app/environment";
  import Clock from "phosphor-svelte/lib/ClockIcon";
  import Files from "phosphor-svelte/lib/FilesIcon";
  import HardDrive from "phosphor-svelte/lib/HardDrivesIcon";
  import Settings from "phosphor-svelte/lib/GearSixIcon";
  import ShieldCheck from "phosphor-svelte/lib/ShieldCheckIcon";
  import TriangleAlert from "phosphor-svelte/lib/WarningIcon";
  import Upload from "phosphor-svelte/lib/UploadSimpleIcon";
  import Button from "$lib/components/Button.svelte";
  import Card from "$lib/components/Card.svelte";
  import CommandLine from "$lib/components/CommandLine.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
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

<main class="page">
  <PageHeader icon={Upload} title="Upload Files">
    {#snippet actions()}
      <Button href="/app/my" icon={Files}>My Files</Button>
    {/snippet}
  </PageHeader>

  <Card icon={Settings} title="Upload Options">
    {#snippet description()}
      Configure these options <strong>before</strong> selecting files.
    {/snippet}

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
  </Card>

  <Card>
    {#if browser}
      <div class="command-line">
        <CommandLine command={curlCommand} placeholder="filename" />
      </div>
    {/if}

    <FileUploader {isDisposable} {isEnabledEncryption} {isUploading} />
  </Card>

  <section class="info-section">
    <div class="info-grid">
      <Card icon={Clock} title="Storage Duration">
        <p>
          Files are automatically deleted after <strong>{data.fileExpiry}</strong>. They may be
          removed earlier depending on server capacity.
        </p>
      </Card>

      <Card icon={HardDrive} title="Storage Capacity">
        <p>
          The server has <strong>{data.storageCapacity}</strong> of available storage. During high traffic,
          uploads may be temporarily unavailable.
        </p>
      </Card>

      <Card icon={ShieldCheck} title="Privacy Policy">
        <p>
          When uploading files, we <strong>permanently</strong> store: file name, file size, file hash,
          and your IP address.
        </p>
      </Card>

      <Card icon={TriangleAlert} title="Important Notice" tone="danger">
        <p class="notice">
          <strong>Do not upload illegal or sensitive files!</strong>
          Use this service responsibly and at your own risk.
        </p>
      </Card>
    </div>
  </section>
</main>

<style>
  .command-line {
    margin-bottom: 32px;
  }

  .options-grid {
    display: flex;
    flex-direction: row;
    gap: 16px;
    flex-wrap: wrap;
  }

  /* Top-aligned, so titles line up even when one description wraps. */
  .option-item {
    display: flex;
    align-items: flex-start;
    gap: 18px;
    cursor: pointer;
    padding: 16px;
    border: 2px solid var(--color-brand-subtle);
    border-radius: var(--radius-md);
    background: var(--color-brand-faint);
    transition: all var(--transition);
    flex: 1;
    min-width: 200px;
  }

  .option-item:hover {
    border-color: var(--color-brand-border);
    background: var(--color-brand-subtle);
  }

  .option-item input {
    margin-top: 4px;
  }

  .option-label {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .option-label strong {
    color: var(--color-text);
    font-weight: 600;
  }

  .option-label small {
    color: var(--color-text-secondary);
    font-size: var(--text-sm);
  }

  .info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 24px;
  }

  .info-grid p {
    margin: 0;
    color: var(--color-text-secondary);
    line-height: 1.6;
  }

  .info-grid .notice {
    color: var(--color-danger-strong);
  }

  @media (max-width: 768px) {
    /* The command line hides itself on phones; its spacing goes with it. */
    .command-line {
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
</style>
