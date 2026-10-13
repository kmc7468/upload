<script lang="ts">
  import FolderNameEditor from "$lib/components/FolderNameEditor.svelte";
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import {
    getUploadedFiles,
    removeExpiredFiles,
    removeUploadedFile,
    updateUploadedFile,
    type UploadedFile,
  } from "$lib/storage";

  import Download from "phosphor-svelte/lib/DownloadSimpleIcon";
  import FileText from "phosphor-svelte/lib/FileTextIcon";
  import Folder from "phosphor-svelte/lib/FolderIcon";
  import FolderOpen from "phosphor-svelte/lib/FolderOpenIcon";
  import KeyRound from "phosphor-svelte/lib/KeyIcon";
  import Lock from "phosphor-svelte/lib/LockIcon";
  import Pencil from "phosphor-svelte/lib/PencilSimpleIcon";
  import Trash from "phosphor-svelte/lib/TrashIcon";
  import TriangleAlert from "phosphor-svelte/lib/WarningIcon";
  import Upload from "phosphor-svelte/lib/UploadSimpleIcon";
  import Button from "$lib/components/Button.svelte";
  import CopyButton from "$lib/components/CopyButton.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import StatusMessage from "$lib/components/StatusMessage.svelte";
  import { confirmAction } from "$lib/confirm.svelte";
  import { responseMessage } from "$lib/transfer";
  import { clock } from "$lib/clock.svelte";
  import { formatDateTime, formatExpiry, plural } from "$lib/utils";
  import { filePagePath, fileSharePath, folderPagePath } from "$lib/urls";

  let uploadedFiles: UploadedFile[] = $state([]);
  // The list lives in this browser, so the server sends the page without it.
  let isLoaded = $state(false);

  // The outcome of the last delete or cleanup, shown below the header.
  let notice = $state<{ tone: "success" | "error"; message: string }>();

  const deleteFile = async (file: UploadedFile) => {
    if (file.isExpired) return;

    const isFolder = file.kind === "folder";
    const confirmed = await confirmAction({
      title: isFolder ? "Delete Folder" : "Delete File",
      message: `"${file.name}"${isFolder ? " and all its files" : ""} will be deleted for everyone with the link. This cannot be undone.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/${isFolder ? "folder" : "file"}/${file.id}`, {
        method: "DELETE",
        headers: {
          "X-Management-Token": file.managementToken,
        },
      });

      if (response.ok) {
        removeUploadedFile(file.id);
        uploadedFiles = uploadedFiles.filter((f) => f.id !== file.id);
        notice = { tone: "success", message: `"${file.name}" has been deleted.` };
      } else if (response.status === 404) {
        // 파일이 이미 삭제되었으면 만료 상태로 표시하고 passphrase 삭제 (보안)
        updateUploadedFile(file.id, { isExpired: true, passphrase: undefined });
        uploadedFiles = uploadedFiles.map((f) =>
          f.id === file.id ? { ...f, isExpired: true, passphrase: undefined } : f,
        );
        notice = {
          tone: "error",
          message: `"${file.name}" no longer exists, so it has been marked as expired.`,
        };
      } else {
        notice = {
          tone: "error",
          message:
            (await responseMessage(response)) ??
            `Could not delete "${file.name}". Please try again.`,
        };
      }
    } catch {
      notice = {
        tone: "error",
        message: "Could not reach the server. Check your connection and try again.",
      };
    }
  };

  // Expiry times reported by the server, kept for this visit only.
  let expireAt = $state<Record<string, number>>({});

  // The list is shown as stored at once, then corrected when the server answers for every
  // upload in one request. Without an answer, the stored state is kept as it is, so a
  // network error never marks a file as expired or discards its passphrase.
  const validateFiles = async (files: UploadedFile[]) => {
    let results: { exists: boolean; name?: string; expireAt?: number }[];
    try {
      const response = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uploads: files.map(({ kind = "file", id, managementToken }) => ({
            kind,
            id,
            managementToken,
          })),
        }),
      });
      if (!response.ok) return;
      ({ results } = await response.json());
    } catch {
      return;
    }

    files.forEach((file, index) => {
      const result = results[index];
      if (!result) return;
      if (result.expireAt) expireAt[file.id] = result.expireAt;

      // The passphrase of an expired file is discarded at once.
      const updates: Partial<UploadedFile> = result.exists
        ? { isExpired: false, name: (file.kind === "folder" && result.name) || file.name }
        : { isExpired: true, passphrase: undefined };
      // Storage is written only when something changed.
      if (
        Object.entries(updates).every(([key, value]) => file[key as keyof UploadedFile] === value)
      )
        return;

      updateUploadedFile(file.id, updates);
      uploadedFiles = uploadedFiles.map((f) => (f.id === file.id ? { ...f, ...updates } : f));
    });
  };

  const cleanupExpiredFiles = async () => {
    const count = uploadedFiles.filter((file) => file.isExpired).length;
    if (count === 0) return;

    const files = count === 1 ? "file" : "files";
    const confirmed = await confirmAction({
      title: "Remove Expired Files",
      message: `Remove ${count} expired ${files} from this list? They are already gone from the server.`,
      confirmLabel: "Remove",
    });
    if (!confirmed) return;

    // 만료되지 않은 파일만 유지
    removeExpiredFiles();
    uploadedFiles = uploadedFiles.filter((file) => !file.isExpired);
    notice = { tone: "success", message: `Removed ${count} expired ${files} from the list.` };
  };

  const getDownloadUrl = (file: UploadedFile) =>
    file.kind === "folder" ? folderPagePath(file.id) : fileSharePath(file);

  const getFullDownloadUrl = (file: UploadedFile) => `${page.url.origin}${getDownloadUrl(file)}`;

  // The forms that rename folders, opened from each folder's Rename Folder button.
  let editors: Record<string, ReturnType<typeof FolderNameEditor>> = $state({});

  const expiredCount = $derived(uploadedFiles.filter((file) => file.isExpired).length);

  // 활성 파일을 먼저 표시하도록 정렬
  const sortedFiles = $derived(
    [...uploadedFiles].sort((a, b) => {
      if (a.isExpired && !b.isExpired) return 1;
      if (!a.isExpired && b.isExpired) return -1;
      return b.uploadedAt.getTime() - a.uploadedAt.getTime();
    }),
  );

  onMount(() => {
    try {
      uploadedFiles = getUploadedFiles();
    } catch {
      // Without browser storage there is nothing to list.
    }
    isLoaded = true;
    if (uploadedFiles.length) validateFiles(uploadedFiles);
  });
</script>

<svelte:head>
  <title>My Files - Minchan's Upload</title>
</svelte:head>

<div class="page">
  <PageHeader
    title="My Files"
    description="Uploads from this browser. This list stays on this device."
  >
    {#snippet actions()}
      <Button icon={Trash} onclick={cleanupExpiredFiles} disabled={expiredCount === 0}>
        {expiredCount === 0
          ? "No Expired Files"
          : `Remove ${expiredCount} Expired ${expiredCount === 1 ? "File" : "Files"}`}
      </Button>
      <Button variant="primary" href="/app" icon={Upload}>Upload Files</Button>
    {/snippet}
  </PageHeader>

  {#if notice}
    <StatusMessage tone={notice.tone}>{notice.message}</StatusMessage>
  {/if}

  {#if !isLoaded}
    <!-- Nothing is shown until the list is read from this browser. -->
  {:else if uploadedFiles.length === 0}
    <section class="card state">
      <span class="tile lg"><FolderOpen /></span>
      <h3>No Files Uploaded Yet</h3>
      <p>Files you upload will appear here for easy management.</p>
    </section>
  {:else}
    <ul class="card file-list">
      {#each sortedFiles as file (file.id)}
        <li class="file-row" class:expired={file.isExpired}>
          <span class={["tile", { muted: file.isExpired }]}>
            {#if file.kind === "folder"}<Folder />{:else}<FileText />{/if}
          </span>
          <div class="file-main">
            <div class="file-heading">
              <h3 class="file-title" title={file.name}>
                {#if file.isExpired}
                  {file.name}
                {:else}
                  <!-- The link covers the whole row, so any part of it opens the file. -->
                  <a
                    class="row-link"
                    href={file.kind === "folder" ? folderPagePath(file.id) : filePagePath(file.id)}
                    >{file.name}</a
                  >
                {/if}
              </h3>
              {#if file.isEncrypted}
                <span class="badge"><Lock />Encrypted</span>
              {/if}
              {#if file.isExpired}
                <span class="badge danger"><TriangleAlert />Expired</span>
              {/if}
            </div>
            <p class="meta-list">
              {#if file.kind === "folder" && file.fileCount}
                <span>{plural(file.fileCount, "file")}</span>
              {/if}
              <span>Uploaded {formatDateTime(file.uploadedAt)}</span>
              {#if file.isExpired}
                <span>No longer available for download</span>
              {:else if expireAt[file.id]}
                <span title={formatDateTime(expireAt[file.id])}>
                  {formatExpiry(expireAt[file.id], clock.now)}
                </span>
              {/if}
            </p>
          </div>

          {#if !file.isExpired}
            <div class="file-actions">
              <Button
                size="sm"
                icon={Download}
                href={getDownloadUrl(file)}
                target="_blank"
                rel="noopener noreferrer"
              >
                Download
              </Button>
              <CopyButton text={getFullDownloadUrl(file)} variant="ghost" size="sm" iconOnly />
              {#if file.kind === "folder"}
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  icon={Pencil}
                  aria-label="Rename Folder"
                  onclick={() => editors[file.id]?.startEditing()}
                />
              {/if}
              {#if file.isEncrypted && file.passphrase}
                <CopyButton
                  text={file.passphrase}
                  label="Copy Passphrase"
                  icon={KeyRound}
                  variant="ghost"
                  size="sm"
                  iconOnly
                />
              {/if}
              <Button
                variant="danger-ghost"
                size="sm"
                iconOnly
                icon={Trash}
                aria-label="Delete"
                onclick={() => deleteFile(file)}
              />
            </div>

            {#if file.kind === "folder"}
              <div class="file-editor">
                <FolderNameEditor
                  bind:this={editors[file.id]}
                  variant="my"
                  id={file.id}
                  name={file.name}
                  managementToken={file.managementToken}
                  onsave={(name) => {
                    uploadedFiles = uploadedFiles.map((entry) =>
                      entry.id === file.id ? { ...entry, name } : entry,
                    );
                  }}
                />
              </div>
            {/if}
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .state {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 48px 24px;
    text-align: center;
  }

  .state .tile {
    margin-bottom: 16px;
  }

  .state h3 {
    margin: 0;
    font-size: var(--text-base);
    font-weight: 600;
    line-height: 1.5;
    color: var(--color-text);
  }

  .state p {
    margin: 4px 0 0;
    font-size: var(--text-md);
    color: var(--color-text-secondary);
  }

  /* One card holds every file, divided by hairlines. */
  .file-list {
    margin: 0;
    padding: 0;
    overflow: hidden;
    list-style: none;
  }

  .file-row {
    --row-indent: calc(40px + 14px);
    position: relative;
    /* The layers below stay within the row. */
    isolation: isolate;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px 14px;
    padding: 16px 20px;
    transition: background var(--transition);
  }

  .file-row + .file-row {
    border-top: 1px solid var(--color-border);
  }

  .file-row:not(.expired):hover {
    background: var(--color-surface-hover);
  }

  .file-row.expired .file-main {
    opacity: 0.6;
  }

  .file-main {
    flex: 1;
    min-width: 0;
  }

  .file-heading {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .file-title {
    min-width: 0;
    margin: 0;
    overflow: hidden;
    font-size: var(--text-base);
    font-weight: 600;
    line-height: 1.5;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--color-text);
  }

  .row-link {
    color: inherit;
    font-weight: inherit;
    -webkit-tap-highlight-color: transparent;
  }

  .row-link:hover {
    text-decoration: none;
  }

  /* Layered over the meta list, whose clip-path would otherwise paint it above the link. */
  .row-link::after {
    content: "";
    position: absolute;
    inset: 0;
    z-index: 1;
  }

  /* The ring is drawn around the row the link covers, inside the card's rounded edge. */
  .row-link:focus-visible {
    outline: none;
  }

  .row-link:focus-visible::after {
    outline: 2px solid var(--color-accent);
    outline-offset: -2px;
  }

  /* Buttons and the rename form sit above the link, and the gaps between them open nothing. */
  .file-actions,
  .file-editor {
    position: relative;
    z-index: 2;
  }

  .file-actions {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  /* The download button stands a little apart from the icon buttons after it. */
  .file-actions > :global(.button:first-child) {
    margin-right: 6px;
  }

  /* The rename form opens on its own line, under the name. */
  .file-editor {
    flex-basis: 100%;
    padding-left: var(--row-indent);
  }

  .file-editor:not(:has(form)) {
    display: none;
  }

  @media (max-width: 768px) {
    .file-row {
      align-items: flex-start;
      padding: 16px;
    }

    .file-actions {
      width: 100%;
      padding-left: var(--row-indent);
    }
  }

  @media (max-width: 480px) {
    .file-editor {
      padding-left: 0;
    }
  }
</style>
