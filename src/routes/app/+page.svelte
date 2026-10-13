<script lang="ts">
  import { writable } from "svelte/store";
  import { browser } from "$app/environment";
  import Clock from "phosphor-svelte/lib/ClockIcon";
  import Files from "phosphor-svelte/lib/FilesIcon";
  import HardDrive from "phosphor-svelte/lib/HardDrivesIcon";
  import ShieldCheck from "phosphor-svelte/lib/ShieldCheckIcon";
  import TriangleAlert from "phosphor-svelte/lib/WarningIcon";
  import Button from "$lib/components/Button.svelte";
  import CommandLine from "$lib/components/CommandLine.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import StatusMessage from "$lib/components/StatusMessage.svelte";
  import { shellQuote } from "$lib/shell";
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
      ? `openssl enc -e -aes-256-cbc -pbkdf2 < filename | curl -T - ${shellQuote(`${origin}/${options}/filename`)}`
      : `curl -T filename ${shellQuote(`${origin}/${options && `${options}/`}`)}`;
  });
</script>

<svelte:head>
  <title>Minchan's Upload</title>
</svelte:head>

<main class="page">
  <PageHeader
    title="Upload Files"
    description={`Share files for ${data.fileExpiry} from your browser or terminal.`}
  >
    {#snippet actions()}
      <Button href="/app/my" icon={Files}>My Files</Button>
    {/snippet}
  </PageHeader>

  <section class="card">
    <!-- Options come first, as they apply to the files selected next. -->
    <div class="options" role="group" aria-label="Upload Options">
      <label class="option">
        <span class="option-text">
          <strong>Single Download</strong>
          <small>Files will be deleted after one complete download</small>
        </span>
        <input
          type="checkbox"
          role="switch"
          class="switch"
          bind:checked={isDisposable}
          disabled={$isUploading}
        />
      </label>

      {#if browser && window.crypto.subtle}
        <label class="option">
          <span class="option-text">
            <strong>End-to-End Encryption</strong>
            <small>Files will be encrypted before uploading</small>
          </span>
          <input
            type="checkbox"
            role="switch"
            class="switch"
            bind:checked={isEnabledEncryption}
            disabled={$isUploading}
          />
        </label>
      {/if}
    </div>

    <div class="card-section">
      <FileUploader {isDisposable} {isEnabledEncryption} {isUploading} />
    </div>
  </section>

  {#if browser}
    <CommandLine command={curlCommand} placeholder="filename" />
  {/if}

  <section class="info-section">
    <div>
      <h3><Clock />Storage Duration</h3>
      <p>
        Files are automatically deleted after <strong>{data.fileExpiry}</strong>. They may be
        removed earlier depending on server capacity.
      </p>
    </div>
    <div>
      <h3><HardDrive />Storage Capacity</h3>
      <p>
        The server has <strong>{data.storageCapacity}</strong> of available storage. During high traffic,
        uploads may be temporarily unavailable.
      </p>
    </div>
    <div>
      <h3><ShieldCheck />Privacy Policy</h3>
      <p>
        When uploading files, we <strong>permanently</strong> store: file name, file size, file hash,
        and your IP address.
      </p>
    </div>
  </section>

  <StatusMessage tone="error" icon={TriangleAlert} role="note">
    <strong>Do not upload illegal or sensitive files!</strong>
    Use this service responsibly and at your own risk.
  </StatusMessage>
</main>

<style>
  .options {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 16px 32px;
  }

  /* Top-aligned, so the switch stays beside the title when the description wraps. */
  .option {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    cursor: pointer;
    /* Clicking quickly to flip a switch back should not select its text. */
    user-select: none;
  }

  .option:has(:disabled) {
    cursor: not-allowed;
  }

  .option-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .option-text strong {
    font-size: var(--text-md);
    font-weight: 600;
    line-height: 1.5;
    color: var(--color-text);
  }

  .option-text small {
    font-size: var(--text-sm);
    line-height: 1.5;
    color: var(--color-text-muted);
  }

  /* A checkbox drawn as a sliding switch */
  .switch {
    appearance: none;
    position: relative;
    flex-shrink: 0;
    width: 36px;
    height: 20px;
    margin: 1px 0 0;
    border-radius: var(--radius-pill);
    background: var(--color-border-strong);
    transition: background var(--transition);
  }

  .switch::after {
    content: "";
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #ffffff;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
    transition: transform var(--transition);
  }

  .switch:checked {
    background: var(--color-accent);
  }

  .switch:checked::after {
    transform: translateX(16px);
  }

  .switch:disabled {
    opacity: 0.5;
  }

  @media (prefers-reduced-motion: reduce) {
    .switch,
    .switch::after {
      transition: none;
    }
  }
</style>
