<script lang="ts">
  import { onMount } from "svelte";
  import { browser } from "$app/environment";
  import { 
    getUploadedFiles,
    removeExpiredFiles,
    removeUploadedFile,
    updateUploadedFile,
    type UploadedFile,
  } from "$lib/storage";

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
    let expiredCount = 0;
    
    for (let i = 0; i < storedFiles.length; i++) {
      const file = storedFiles[i];
      const exists = await checkFileExists(file);
      
      // 진행 상황을 새 객체로 업데이트
      validationProgress = { 
        current: i + 1, 
        total: storedFiles.length 
      };
      
      // 이전에 만료되지 않았던 파일이 지금 만료되었는지 확인
      const wasExpired = file.isExpired || false;
      const isNowExpired = !exists;
      
      if (!wasExpired && isNowExpired) {
        expiredCount++;
      }
      
      // 만료된 파일의 경우 passphrase 즉시 삭제 (보안)
      const updatedFile = isNowExpired 
        ? { ...file, isExpired: true, passphrase: undefined }
        : { ...file, isExpired: isNowExpired };
      
      // 변경이 감지된 경우 즉시 localStorage 업데이트
      if (file.isExpired !== updatedFile.isExpired || 
          file.passphrase !== updatedFile.passphrase) {
        updateUploadedFile(file.id, {
          isExpired: updatedFile.isExpired,
          passphrase: updatedFile.passphrase
        });
      }
      
      updatedFiles.push(updatedFile);

      // UI 업데이트를 위한 짧은 지연
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // 파일 상태를 UI에 반영
    uploadedFiles = updatedFiles;
    
    isInitializing = false;
  };

  const deleteFile = async (file: UploadedFile) => {
    if (file.isExpired) {
      alert("Cannot delete expired files. Use the cleanup button to remove them from your list.");
      return;
    }

    if (!confirm(`Are you sure you want to delete "${file.name}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/file/${file.id}`, {
        method: "DELETE",
        headers: {
          "X-Management-Token": file.managementToken,
        },
      });

      if (response.ok) {
        removeUploadedFile(file.id);
        uploadedFiles = uploadedFiles.filter(f => f.id !== file.id);
        alert("File deleted successfully.");
      } else if (response.status === 404) {
        // 파일이 이미 삭제되었으면 만료 상태로 표시하고 passphrase 삭제 (보안)
        updateUploadedFile(file.id, { isExpired: true, passphrase: undefined });
        uploadedFiles = uploadedFiles.map(f => 
          f.id === file.id ? { ...f, isExpired: true, passphrase: undefined } : f
        );
        alert("File not found. It has been marked as expired.");
      } else {
        alert("Failed to delete file.");
      }
    } catch (error) {
      alert("An error occurred while deleting the file.");
      console.error(error);
    }
  };

  const checkFileExists = async (file: UploadedFile): Promise<boolean> => {
    try {
      // Management token을 사용한 정확한 파일 검증
      const response = await fetch(`/api/file/${file.id}/verify`, {
        method: "GET",
        headers: {
          "X-Management-Token": file.managementToken,
        },
      });

      if (response.ok) {
        const result = await response.json();
        return result.exists;
      }
      return false;
    } catch {
      return false;
    }
  };

  const cleanupExpiredFiles = async () => {
    const expiredFiles = uploadedFiles.filter(file => file.isExpired);
    
    if (expiredFiles.length === 0) {
      alert("No expired files to remove.");
      return;
    }

    if (!confirm(`This will remove ${expiredFiles.length} expired files from your list. Continue?`)) {
      return;
    }

    // 만료되지 않은 파일만 유지
    removeExpiredFiles();
    uploadedFiles = uploadedFiles.filter(file => !file.isExpired);
  };

  const getDownloadUrl = (file: UploadedFile) => {
    if (file.isEncrypted) {
      return `/app/file/${file.id}`;
    } else {
      return `/${file.id}/${encodeURIComponent(file.name)}`;
    }
  };

  const getFullDownloadUrl = (file: UploadedFile) => {
    const path = getDownloadUrl(file);
    if (browser) {
      return `${window.location.origin}${path}`;
    }
    return path;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Copied to clipboard!");
  };

  // 활성 파일을 먼저 표시하도록 정렬
  const sortedFiles = $derived([...uploadedFiles].sort((a, b) => {
    if (a.isExpired && !b.isExpired) return 1;
    if (!a.isExpired && b.isExpired) return -1;
    return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
  }));

  onMount(() => {
    loadAndValidateFiles(); // Intended
  });
</script>

<svelte:head>
  <title>My Files - Minchan's Upload</title>
</svelte:head>

<main class="main">
  <section class="upload-section">
    <div class="section-header">
      <h2 class="section-title">
        <span class="section-icon">📁</span>
        My Files
      </h2>
      <div class="header-actions">
        <button 
          class="btn-secondary"
          onclick={cleanupExpiredFiles}
          disabled={isLoading || uploadedFiles.filter(f => f.isExpired).length === 0}
        >
          {uploadedFiles.filter(f => f.isExpired).length === 0 
            ? "🗑️ No expired files" 
            : `🗑️ Remove ${uploadedFiles.filter(f => f.isExpired).length} expired files`}
        </button>
        <a href="/app" class="btn-primary">⬆️ Upload new file</a>
      </div>
    </div>

    {#if isInitializing}
      <div class="loading-state">
        <div class="loading-icon">⏳</div>
        <h3>Checking files...</h3>
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
      </div>
    {:else if uploadedFiles.length === 0}
      <div class="empty-state">
        <div class="empty-icon">📂</div>
        <h3>No files uploaded yet</h3>
        <p>Files you upload will appear here for easy management.</p>
        <a href="/app" class="btn-primary">Upload your first file</a>
      </div>
    {:else}
      <div class="files-grid">
        {#each sortedFiles as file (file.id)}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div 
            class="file-card" 
            class:expired={file.isExpired}
            class:clickable={!file.isExpired}
            onclick={() => {
              if (!file.isExpired) {
                window.location.href = `/app/file/${file.id}`;
              }
            }}
          >
            <div class="file-header">
              <div class="file-info">
                <h3 class="file-name">
                  {file.name}
                  {#if file.isExpired}
                    <span class="expired-badge">⚠️ Expired</span>
                  {/if}
                </h3>
                <div class="file-meta">
                  <span class="file-id">ID: {file.id}</span>
                  {#if file.isEncrypted}
                    <span class="file-encrypted">🔐 Encrypted</span>
                  {/if}
                </div>
                <div class="file-date">
                  Uploaded: {formatDate(file.uploadedAt)}
                </div>
                {#if file.isExpired}
                  <div class="file-expired-notice">
                    This file is no longer available for download.
                  </div>
                {/if}
              </div>
            </div>

            <div class="file-actions">
              <button
                class="btn-secondary"
                onclick={(e) => {
                  e.stopPropagation();
                  copyToClipboard(getFullDownloadUrl(file));
                }}
                disabled={file.isExpired}
              >
                📋 Copy URL
              </button>
              
              {#if file.isExpired}
                <button
                  class="btn-primary"
                  disabled
                  onclick={(e) => e.stopPropagation()}
                >
                  📥 Download
                </button>
              {:else}
                <a
                  href={getDownloadUrl(file)}
                  class="btn-primary"
                  target="_blank"
                  rel="noopener noreferrer"
                  onclick={(e) => e.stopPropagation()}
                >
                  📥 Download
                </a>
              {/if}

              {#if file.isEncrypted && file.passphrase}
                <button
                  class="btn-info"
                  onclick={(e) => {
                    e.stopPropagation();
                    copyToClipboard(file.passphrase!);
                  }}
                  title="Copy passphrase"
                  disabled={file.isExpired}
                >
                  🔑 Copy passphrase
                </button>
              {/if}

              <button
                class="btn-danger"
                onclick={(e) => {
                  e.stopPropagation();
                  deleteFile(file);
                }}
                disabled={file.isExpired}
              >
                🗑️ Delete
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </section>
</main>

<style>
  .main {
    min-height: 100vh;
    padding: 2rem;
    max-width: 1200px;
    margin: 0 auto;
  }

  .upload-section {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    border-radius: 16px;
    padding: 2rem;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
    padding-bottom: 1rem;
    border-bottom: 2px solid rgba(102, 126, 234, 0.1);
  }

  .section-title {
    margin: 0;
    font-size: 2rem;
    font-weight: 700;
    color: #2d3748;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .section-icon {
    font-size: 2rem;
  }

  .header-actions {
    display: flex;
    gap: 1rem;
    align-items: center;
  }

  .empty-state {
    text-align: center;
    padding: 4rem 2rem;
    color: #718096;
  }

  .empty-icon {
    font-size: 5rem;
    margin-bottom: 1.5rem;
    opacity: 0.6;
  }

  .empty-state h3 {
    margin: 0 0 1rem 0;
    color: #2d3748;
    font-size: 1.5rem;
    font-weight: 600;
  }

  .empty-state p {
    margin: 0 0 2rem 0;
    font-size: 1.1rem;
    line-height: 1.6;
  }

  .loading-state {
    text-align: center;
    padding: 4rem 2rem;
    color: #718096;
  }

  .loading-icon {
    font-size: 4rem;
    margin-bottom: 1.5rem;
    animation: pulse 2s infinite;
  }

  .loading-state h3 {
    margin: 0 0 1rem 0;
    color: #2d3748;
    font-size: 1.5rem;
    font-weight: 600;
  }

  .loading-state p {
    margin: 0 0 1.5rem 0;
    font-size: 1.1rem;
    line-height: 1.6;
  }

  .progress-container {
    max-width: 300px;
    margin: 0 auto;
  }

  .progress-bar {
    width: 100%;
    height: 8px;
    background: rgba(226, 232, 240, 0.8);
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 0.5rem;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 4px;
    transition: width 0.3s ease;
  }

  .progress-text {
    font-size: 0.9rem;
    color: #718096;
    font-weight: 500;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  .files-grid {
    display: grid;
    gap: 1.5rem;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  }

  .file-card {
    background: white;
    border: 1px solid rgba(226, 232, 240, 0.8);
    border-radius: 12px;
    padding: 1.5rem;
    transition: all 0.3s ease;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  }

  .file-card.clickable {
    cursor: pointer;
  }

  .file-card.clickable:hover {
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
    transform: translateY(-2px);
    border-color: #667eea;
  }

  .file-card.expired {
    background: #fafafa;
    border-color: #f56565;
    opacity: 0.7;
    cursor: default;
  }

  .file-card.expired:hover {
    transform: none;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
    border-color: #f56565;
  }

  .file-header {
    margin-bottom: 1.5rem;
  }

  .file-name {
    margin: 0 0 0.75rem 0;
    font-size: 1.2rem;
    font-weight: 600;
    color: #2d3748;
    word-break: break-word;
    line-height: 1.4;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .expired-badge {
    font-size: 0.8rem;
    color: #f56565;
    background: rgba(245, 101, 101, 0.1);
    padding: 0.2rem 0.5rem;
    border-radius: 6px;
    border: 1px solid rgba(245, 101, 101, 0.2);
    font-weight: 500;
  }

  .file-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .file-id {
    font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
    font-size: 0.8rem;
    color: #4a5568;
    background: #f7fafc;
    padding: 0.3rem 0.6rem;
    border-radius: 6px;
    border: 1px solid #e2e8f0;
  }

  .file-encrypted {
    font-size: 0.8rem;
    color: #667eea;
    background: rgba(102, 126, 234, 0.1);
    padding: 0.3rem 0.6rem;
    border-radius: 6px;
    border: 1px solid rgba(102, 126, 234, 0.2);
    font-weight: 500;
  }

  .file-date {
    font-size: 0.9rem;
    color: #718096;
    font-weight: 500;
  }

  .file-expired-notice {
    font-size: 0.85rem;
    color: #f56565;
    font-style: italic;
    margin-top: 0.5rem;
    padding: 0.5rem;
    background: rgba(245, 101, 101, 0.05);
    border-radius: 6px;
    border: 1px solid rgba(245, 101, 101, 0.1);
  }

  .file-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .btn-primary, .btn-secondary, .btn-danger, .btn-info {
    padding: 0.75rem 1.25rem;
    border: none;
    border-radius: 8px;
    font-size: 0.9rem;
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
    transition: all 0.2s ease;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    min-height: 40px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .btn-primary {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
  }

  .btn-primary:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
    color: white;
    text-decoration: none;
  }

  .btn-secondary {
    background: white;
    color: #4a5568;
    border: 2px solid #e2e8f0;
  }

  .btn-secondary:hover {
    background: #f7fafc;
    border-color: #cbd5e0;
    transform: translateY(-1px);
    color: #4a5568;
    text-decoration: none;
  }

  .btn-secondary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  .btn-primary:disabled {
    background: #cbd5e0 !important;
    color: #a0aec0 !important;
    cursor: not-allowed !important;
    opacity: 1;
  }

  .btn-primary:disabled:hover {
    transform: none !important;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1) !important;
    cursor: not-allowed !important;
  }

  .btn-info:disabled, .btn-danger:disabled {
    background: #cbd5e0;
    color: #a0aec0;
    cursor: not-allowed;
  }

  .btn-info:disabled:hover, .btn-danger:disabled:hover {
    transform: none;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .btn-info {
    background: linear-gradient(135deg, #4299e1 0%, #3182ce 100%);
    color: white;
  }

  .btn-info:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(66, 153, 225, 0.3);
  }

  .btn-danger {
    background: linear-gradient(135deg, #f56565 0%, #e53e3e 100%);
    color: white;
  }

  .btn-danger:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(245, 101, 101, 0.3);
  }

  @media (max-width: 768px) {
    .main {
      padding: 1rem;
    }

    .upload-section {
      padding: 1.5rem;
    }

    .section-header {
      flex-direction: column;
      align-items: stretch;
      gap: 1rem;
    }

    .section-title {
      align-self: center;
      font-size: 1.75rem;
    }

    .header-actions {
      justify-content: center;
    }

    .files-grid {
      grid-template-columns: 1fr;
    }

    .file-actions {
      flex-direction: column;
    }

    .btn-primary, .btn-secondary, .btn-danger, .btn-info {
      width: 100%;
      justify-content: center;
    }
  }

  @media (max-width: 480px) {
    .section-title {
      font-size: 1.5rem;
    }

    .file-card {
      padding: 1rem;
    }
  }
</style>