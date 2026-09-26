<script lang="ts">
  import { tick } from "svelte";
  import { updateUploadedFile } from "$lib/storage";

  let {
    id,
    name,
    managementToken,
    expanded = false,
    fileCount = 0,
    isEncrypted = false,
    variant = "upload",
    onsave,
  }: {
    id: string;
    name: string;
    managementToken: string;
    expanded?: boolean;
    fileCount?: number;
    isEncrypted?: boolean;
    variant?: "upload" | "folder" | "my";
    onsave?: (name: string) => void;
  } = $props();
  let editing = $state(false);
  let draft = $state("");
  let saving = $state(false);
  let errorMessage = $state("");
  const inputId = $props.id();
  let nameInput = $state<HTMLInputElement>();
  const startEditing = async () => {
    if (saving || !managementToken) return;
    draft = name;
    editing = true;
    errorMessage = "";
    await tick();
    nameInput?.focus();
    nameInput?.select();
  };
  const cancel = () => {
    if (!saving) {
      editing = false;
      errorMessage = "";
    }
  };

  const save = async () => {
    if (saving) return;
    saving = true;
    errorMessage = "";
    try {
      const response = await fetch(`/api/folder/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-Management-Token": managementToken },
        body: JSON.stringify({ name: draft }),
      });
      if (!response.ok)
        throw new Error(
          response.status === 404
            ? "This folder has expired or been deleted."
            : response.status === 403
              ? "You don't have permission to rename this folder."
              : "Could not save the folder name. Please try again.",
        );
      const result = await response.json();
      updateUploadedFile(id, { name: result.name });
      onsave?.(result.name);
      editing = false;
      errorMessage = "";
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : "Could not save the folder name.";
    } finally {
      saving = false;
    }
  };
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="folder-name-editor"
  class:folder={variant === "folder"}
  class:my={variant === "my"}
  onclick={(event) => event.stopPropagation()}
  onkeydown={(event) => {
    event.stopPropagation();
    if (event.key === "Escape") cancel();
  }}
>
  {#if variant === "folder"}
    <form
      class="title-form"
      class:editing
      onsubmit={(event) => {
        event.preventDefault();
        if (editing) save();
      }}
    >
      <div class="title-details">
        {#if editing}
          <input
            class="title-input"
            id={inputId}
            bind:this={nameInput}
            type="text"
            aria-label="Folder Name"
            bind:value={draft}
            required
            maxlength={200}
            disabled={saving}
          />
        {:else}
          <h3 class="folder-title" title={name}>{name}</h3>
        {/if}
        <div class="folder-meta">
          <span class="file-count">{fileCount} files</span>
          {#if isEncrypted}<span class="encryption-badge">🔐 Encrypted</span>{/if}
        </div>
      </div>
      {#if managementToken}
        <div class="title-actions">
          {#if editing}
            <button type="submit" disabled={saving || !draft.trim()}
              >{saving ? "Saving..." : "Save"}</button
            >
            <button type="button" class="secondary" disabled={saving} onclick={cancel}
              >Cancel</button
            >
          {:else}
            <button type="button" onclick={startEditing}>✏️ Rename Folder</button>
          {/if}
        </div>
      {/if}
    </form>
  {:else if editing}
    <form
      onsubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <label for={inputId}>Folder Name</label>
      <div class="edit-controls">
        <input
          id={inputId}
          bind:this={nameInput}
          type="text"
          bind:value={draft}
          required
          maxlength={200}
          disabled={saving}
        />
        <button type="submit" disabled={saving || !draft.trim()}
          >{saving ? "Saving..." : "Save"}</button
        >
        <button type="button" class="secondary" disabled={saving} onclick={cancel}>Cancel</button>
      </div>
    </form>
  {:else}
    {#if expanded}<div class="current-name" title={name}>📁 {name}</div>{/if}
    <button type="button" class="secondary" onclick={startEditing}>✏️ Rename Folder</button>
  {/if}
  {#if errorMessage}<p class="error" role="status">{errorMessage}</p>{/if}
</div>

<style>
  .folder-name-editor {
    --editor-radius: 8px;
    --editor-padding: 8px 16px;
    --editor-font: var(--upload-control-font, 14px);
    --editor-height: var(--upload-control-height, 40px);
    min-width: 0;
    width: 100%;
  }

  .title-form {
    display: flex;
    align-items: center;
    gap: 20px;
  }

  .title-form.editing {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px;
    align-items: start;
  }

  .editing .title-details {
    display: contents;
  }

  .title-form.editing input.title-input {
    grid-column: 1;
    grid-row: 1;
    height: 46px;
    margin: 0;
    line-height: 24px;
  }

  .editing .title-actions {
    grid-column: 2;
    grid-row: 1;
  }

  .editing .title-actions button {
    height: 46px;
    min-height: 46px;
  }

  .editing .folder-meta {
    grid-column: 1 / -1;
    grid-row: 2;
  }

  .title-details {
    flex: 1;
    min-width: 0;
  }

  .folder-title {
    margin: 0 0 8px;
    font-size: 20px;
    font-weight: 600;
    color: #333;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .folder-meta {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px 12px;
  }

  .encryption-badge {
    display: inline-flex;
    align-items: center;
    padding: 6px 12px;
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid rgba(59, 130, 246, 0.2);
    border-radius: 20px;
    font-size: 14px;
    font-weight: 600;
    color: #3b82f6;
  }

  .file-count {
    font-size: 14px;
    color: #666;
  }

  input[type="text"].title-input {
    font-size: 20px;
    font-weight: 600;
    margin-bottom: 8px;
  }

  .title-actions {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
  }

  .folder {
    --editor-radius: 12px;
    --editor-padding: 12px 20px;
    --editor-height: 46px;
  }

  .my {
    --editor-padding: 12px 20px;
    --editor-font: 0.9rem;
    --editor-height: 51px;
  }

  form {
    text-align: left;
  }

  label {
    display: block;
    margin-bottom: 8px;
    font-size: var(--editor-label-size, 14px);
    font-weight: 600;
    color: #333;
  }

  .current-name {
    margin-bottom: 8px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 600;
  }

  .edit-controls {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    align-items: stretch;
    gap: 8px;
  }

  input[type="text"] {
    min-width: 0;
    width: 100%;
    padding: 8px 12px;
    border: 2px solid rgba(102, 126, 234, 0.2);
    border-radius: var(--editor-radius);
    background: rgba(255, 255, 255, 0.9);
    color: #333;
    font-size: 14px;
    line-height: inherit;
  }

  input[type="text"]:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }

  button {
    padding: var(--editor-padding);
    border-radius: var(--editor-radius);
    font-size: var(--editor-font);
    min-height: var(--editor-height);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    white-space: nowrap;
    background: #667eea;
    box-shadow: 0 4px 16px rgba(102, 126, 234, 0.3);
  }

  button:hover:not(:disabled) {
    background: #5a67d8;
    transform: translateY(-1px);
  }

  .my button[type="submit"] {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }

  .my button {
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .secondary {
    padding: 6px 14px;
    background: white;
    color: #4a5568;
    border: 2px solid #e2e8f0;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .folder .secondary {
    padding: 10px 18px;
  }

  .my .secondary {
    padding: 12px 20px;
  }

  .secondary:hover:not(:disabled) {
    background: #f7fafc;
    border-color: #cbd5e0;
    transform: translateY(-1px);
  }

  p {
    margin: 8px 0 0;
    font-size: 14px;
    padding: 12px 16px;
    border-radius: 8px;
    border: 1px solid rgba(239, 68, 68, 0.2);
    text-align: left;
    overflow-wrap: anywhere;
  }

  p.error {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.1);
  }

  @media (max-width: 768px) {
    .folder-meta {
      justify-content: center;
    }
    .editing .folder-meta {
      justify-content: flex-start;
    }

    .title-form.editing {
      gap: 8px;
      text-align: left;
    }

    .editing .title-actions {
      flex-wrap: nowrap;
      gap: 6px;
    }

    .editing .title-actions button {
      padding: 8px;
      font-size: 13px;
    }

    .title-form {
      flex-direction: column;
      gap: 16px;
      text-align: center;
    }

    .title-details {
      width: 100%;
    }

    .title-actions {
      justify-content: center;
      flex-wrap: wrap;
    }

    .folder-title,
    input[type="text"].title-input {
      font-size: 18px;
    }

    .edit-controls {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    }

    input[type="text"] {
      grid-column: 1 / -1;
      min-height: var(--editor-height);
    }

    .my > button {
      width: 100%;
    }
  }
</style>
