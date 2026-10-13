<script lang="ts">
  import FolderNameEditor from "$lib/components/FolderNameEditor.svelte";
  import { onMount } from "svelte";
  import { browser } from "$app/environment";
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
  import LoaderCircle from "phosphor-svelte/lib/CircleNotchIcon";
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

  import "$lib/style.css";

  let uploadedFiles: UploadedFile[] = $state([]);
  let isLoading = $state(false);
  let isInitializing = $state(true);
  let validationProgress = $state({ current: 0, total: 0 });

  const loadAndValidateFiles = async () => {
    const storedFiles = getUploadedFiles();
    if (storedFiles.length === 0) {
      isInitializing = false;
      return;
    }

    validationProgress = { current: 0, total: storedFiles.length };

    // 순차적으로 파일 유효성 검사 (UI 업데이트를 위해)
    const updatedFiles: UploadedFile[] = [];

    for (let i = 0; i < storedFiles.length; i++) {
      const file = storedFiles[i];
      const result = await checkFile(file);

      // 진행 상황을 새 객체로 업데이트
      validationProgress = {
        current: i + 1,
        total: storedFiles.length,
      };

      // Without an answer from the server, the stored state is kept as it is.
      if (!result) {
        updatedFiles.push(file);
        continue;
      }
      if (result.expireAt) {
        expireAt[file.id] = result.expireAt;
      }

      // 이전에 만료되지 않았던 파일이 지금 만료되었는지 확인
      const isNowExpired = !result.exists;

      // 만료된 파일의 경우 passphrase 즉시 삭제 (보안)
      const updatedFile = isNowExpired
        ? { ...file, isExpired: true, passphrase: undefined }
        : { ...file, isExpired: isNowExpired };

      // 변경이 감지된 경우 즉시 localStorage 업데이트
      if (file.isExpired !== updatedFile.isExpired || file.passphrase !== updatedFile.passphrase) {
        updateUploadedFile(file.id, {
          isExpired: updatedFile.isExpired,
          passphrase: updatedFile.passphrase,
        });
      }

      updatedFiles.push(updatedFile);

      // UI 업데이트를 위한 짧은 지연
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    // 파일 상태를 UI에 반영
    uploadedFiles = updatedFiles;

    isInitializing = false;
  };

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

  // Returns undefined when the server could not answer, so a network error never marks a
  // file as expired or discards its passphrase.
  const checkFile = async (
    file: UploadedFile,
  ): Promise<{ exists: boolean; expireAt?: number } | undefined> => {
    try {
      // Management token을 사용한 정확한 파일 검증
      const response = await fetch(
        `/api/${file.kind === "folder" ? "folder" : "file"}/${file.id}/verify`,
        {
          method: "GET",
          headers: {
            "X-Management-Token": file.managementToken,
          },
        },
      );

      if (response.status === 404) {
        return { exists: false };
      } else if (!response.ok) {
        return undefined;
      }

      const result = await response.json();
      if (file.kind === "folder" && result.exists && result.name) {
        file.name = result.name;
        updateUploadedFile(file.id, { name: result.name });
      }
      return { exists: result.exists, expireAt: result.expireAt };
    } catch {
      return undefined;
    }
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

  const getFullDownloadUrl = (file: UploadedFile) => {
    const path = getDownloadUrl(file);
    if (browser) {
      return `${window.location.origin}${path}`;
    }
    return path;
  };

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
    loadAndValidateFiles(); // Intended
  });
</script>

<svelte:head>
  <title>My Files - Minchan's Upload</title>
</svelte:head>

<main class="page">
  <PageHeader
    title="My Files"
    description="Uploads from this browser. This list stays on this device."
  >
    {#snippet actions()}
      <Button icon={Trash} onclick={cleanupExpiredFiles} disabled={isLoading || expiredCount === 0}>
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

  {#if isInitializing}
    <section class="card state" role="status">
      <span class="tile lg spinning"><LoaderCircle /></span>
      <h3>Checking Files...</h3>
      <p>Verifying your uploaded files are still available.</p>
      {#if validationProgress.total > 0}
        <div class="progress-container">
          <div class="progress-bar">
            <div
              class="progress-fill"
              style="width: {(validationProgress.current / validationProgress.total) * 100}%"
            ></div>
          </div>
          <div class="progress-text">
            {validationProgress.current} / {validationProgress.total} files checked
          </div>
        </div>
      {/if}
    </section>
  {:else if uploadedFiles.length === 0}
    <section class="card state">
      <span class="tile lg"><FolderOpen /></span>
      <h3>No Files Uploaded Yet</h3>
      <p>Files you upload will appear here for easy management.</p>
    </section>
  {:else}
    <ul class="card file-list">
      {#each sortedFiles as file (file.id)}
        <!-- The row opens the file; its buttons are also reachable by keyboard. -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <li
          class="file-row"
          class:expired={file.isExpired}
          onclick={() => {
            if (!file.isExpired) {
              window.location.href =
                file.kind === "folder" ? folderPagePath(file.id) : filePagePath(file.id);
            }
          }}
        >
          <span class={["tile", { muted: file.isExpired }]}>
            {#if file.kind === "folder"}<Folder />{:else}<FileText />{/if}
          </span>
          <div class="file-main">
            <div class="file-heading">
              <h3 class="file-title" title={file.name}>{file.name}</h3>
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
            <!-- The whole row opens the file, so its buttons keep their clicks. -->
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div class="file-actions" onclick={(event) => event.stopPropagation()}>
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
</main>

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

  .spinning :global(svg) {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .spinning :global(svg) {
      animation: none;
    }
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

  .progress-container {
    width: 100%;
    max-width: 240px;
    margin-top: 20px;
  }

  .progress-bar {
    height: 6px;
    margin-bottom: 8px;
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

  .progress-text {
    font-size: var(--text-sm);
    color: var(--color-text-muted);
    font-variant-numeric: tabular-nums;
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
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px 14px;
    padding: 16px 20px;
    cursor: pointer;
    transition: background var(--transition);
  }

  .file-row + .file-row {
    border-top: 1px solid var(--color-border);
  }

  .file-row:not(.expired):hover {
    background: var(--color-surface-hover);
  }

  .file-row.expired {
    cursor: default;
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

  .file-actions {
    display: flex;
    align-items: center;
    gap: 2px;
    cursor: default;
  }

  /* The download button stands a little apart from the icon buttons after it. */
  .file-actions > :global(.button:first-child) {
    margin-right: 6px;
  }

  /* The rename form opens on its own line, under the name. */
  .file-editor {
    flex-basis: 100%;
    padding-left: var(--row-indent);
    cursor: default;
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
