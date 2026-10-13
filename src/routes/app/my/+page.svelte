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
  import Files from "phosphor-svelte/lib/FilesIcon";
  import Folder from "phosphor-svelte/lib/FolderIcon";
  import FolderOpen from "phosphor-svelte/lib/FolderOpenIcon";
  import KeyRound from "phosphor-svelte/lib/KeyIcon";
  import LoaderCircle from "phosphor-svelte/lib/CircleNotchIcon";
  import Lock from "phosphor-svelte/lib/LockIcon";
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
  <PageHeader icon={Files} title="My Files">
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
      <div class="state-icon spinning"><LoaderCircle /></div>
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
      <div class="state-icon"><FolderOpen /></div>
      <h3>No Files Uploaded Yet</h3>
      <p>Files you upload will appear here for easy management.</p>
      <Button variant="primary" href="/app" icon={Upload}>Upload Files</Button>
    </section>
  {:else}
    <div class="files-grid">
      {#each sortedFiles as file (file.id)}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="card file-card"
          class:expired={file.isExpired}
          class:clickable={!file.isExpired}
          onclick={() => {
            if (!file.isExpired) {
              window.location.href =
                file.kind === "folder" ? folderPagePath(file.id) : filePagePath(file.id);
            }
          }}
        >
          <div class="file-header">
            <h3 class="file-name">
              <span class="file-kind">
                {#if file.kind === "folder"}<Folder />{:else}<FileText />{/if}
              </span>
              <span class="file-title" title={file.name}>{file.name}</span>
            </h3>
            <div class="meta-row">
              <p class="meta-list">
                {#if file.kind === "folder" && file.fileCount}
                  <span>{plural(file.fileCount, "file")}</span>
                {/if}
                <span>Uploaded {formatDateTime(file.uploadedAt)}</span>
                {#if !file.isExpired && expireAt[file.id]}
                  <span title={formatDateTime(expireAt[file.id])}>
                    {formatExpiry(expireAt[file.id], clock.now)}
                  </span>
                {/if}
              </p>
              {#if file.isEncrypted}
                <span class="badge"><Lock />Encrypted</span>
              {/if}
              {#if file.isExpired}
                <span class="badge danger"><TriangleAlert />Expired</span>
              {/if}
            </div>
            {#if file.isExpired}
              <div class="file-expired-notice">This file is no longer available for download.</div>
            {/if}
          </div>

          <!-- The whole card opens the file, so its buttons keep their clicks. -->
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div class="file-actions" onclick={(event) => event.stopPropagation()}>
            {#if file.kind === "folder" && !file.isExpired}
              <div class="folder-rename">
                <FolderNameEditor
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

            <CopyButton text={getFullDownloadUrl(file)} disabled={file.isExpired} />

            <Button
              variant="primary"
              icon={Download}
              href={getDownloadUrl(file)}
              target="_blank"
              rel="noopener noreferrer"
              disabled={file.isExpired}
            >
              Download
            </Button>

            {#if file.isEncrypted && file.passphrase}
              <CopyButton
                text={file.passphrase}
                label="Copy Passphrase"
                icon={KeyRound}
                disabled={file.isExpired}
              />
            {/if}

            <Button
              variant="danger"
              icon={Trash}
              disabled={file.isExpired}
              onclick={() => deleteFile(file)}
            >
              Delete
            </Button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</main>

<style>
  .state {
    text-align: center;
    padding: 4rem 2rem;
    color: var(--color-text-secondary);
  }

  .state-icon {
    display: flex;
    justify-content: center;
    margin-bottom: 1.5rem;
    font-size: 64px;
    color: var(--color-brand);
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
    margin: 0 0 1rem 0;
    color: var(--color-text);
    font-size: var(--text-2xl);
    font-weight: 600;
  }

  .state p {
    margin: 0 0 2rem 0;
    font-size: var(--text-lg);
    line-height: 1.6;
  }

  .progress-container {
    max-width: 300px;
    margin: 0 auto;
  }

  .progress-bar {
    width: 100%;
    height: 8px;
    background: var(--color-brand-border);
    border-radius: var(--radius-pill);
    overflow: hidden;
    margin-bottom: 0.5rem;
  }

  .progress-fill {
    height: 100%;
    background: var(--gradient-brand);
    border-radius: var(--radius-pill);
    transition: width 0.3s ease;
  }

  .progress-text {
    font-size: var(--text-md);
    color: var(--color-text-secondary);
    font-weight: 500;
  }

  .files-grid {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .file-card {
    transition: all var(--transition);
  }

  .file-card.clickable {
    cursor: pointer;
  }

  .file-card.clickable:hover {
    box-shadow: var(--shadow-md);
    transform: translateY(-2px);
    border-color: var(--color-brand);
  }

  /* The card stays opaque; only its content fades, so the background does not show through. */
  .file-card.expired {
    border-color: var(--color-danger-border);
    cursor: default;
  }

  .file-card.expired .file-header,
  .file-card.expired .file-actions {
    opacity: 0.6;
  }

  .file-header {
    margin-bottom: 20px;
  }

  .file-name {
    margin: 0 0 6px 0;
    font-size: var(--text-lg);
    font-weight: 600;
    color: var(--color-text);
    line-height: 1.4;
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .file-kind {
    display: flex;
    color: var(--color-brand);
  }

  .file-title {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .file-expired-notice {
    margin-top: 12px;
    padding: 0.5rem 0.75rem;
    font-size: var(--text-sm);
    color: var(--color-danger);
    background: var(--color-danger-subtle);
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-danger-border);
  }

  .folder-rename {
    min-width: 0;
  }

  .folder-rename:has(:global(form)) {
    flex-basis: 100%;
  }

  .file-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  @media (max-width: 768px) {
    /* Buttons share rows while they fit, as in the page header, keeping the list short. */
    .file-actions > :global(.button) {
      flex: 1 1 auto;
      white-space: nowrap;
    }

    .folder-rename {
      flex-basis: 100%;
    }
  }

  @media (max-width: 480px) {
    .file-card {
      padding: 16px;
    }
  }
</style>
