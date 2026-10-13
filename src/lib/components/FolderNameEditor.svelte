<script lang="ts">
  import { tick } from "svelte";
  import Folder from "phosphor-svelte/lib/FolderIcon";
  import Lock from "phosphor-svelte/lib/LockIcon";
  import Pencil from "phosphor-svelte/lib/PencilSimpleIcon";
  import { updateUploadedFile } from "$lib/storage";
  import { plural } from "$lib/utils";
  import Button from "./Button.svelte";
  import StatusMessage from "./StatusMessage.svelte";

  let {
    id,
    name,
    managementToken,
    expanded = false,
    fileCount = 0,
    isEncrypted = false,
    details = [],
    variant = "upload",
    onsave,
  }: {
    id: string;
    name: string;
    managementToken: string;
    expanded?: boolean;
    fileCount?: number;
    isEncrypted?: boolean;
    // Facts shown after the file count, such as the total size.
    details?: { text: string; title?: string }[];
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
        <div class="meta-row folder-meta">
          <span class="meta-list">
            <span>{plural(fileCount, "file")}</span>
            {#each details as detail (detail.text)}
              <span title={detail.title}>{detail.text}</span>
            {/each}
          </span>
          {#if isEncrypted}<span class="badge"><Lock />Encrypted</span>{/if}
        </div>
      </div>
      {#if managementToken}
        <div class="title-actions">
          {#if editing}
            <Button type="submit" variant="primary" disabled={saving || !draft.trim()}>
              {saving ? "Saving..." : "Save"}
            </Button>
            <Button disabled={saving} onclick={cancel}>Cancel</Button>
          {:else}
            <Button icon={Pencil} onclick={startEditing}>Rename Folder</Button>
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
      <label class="field-label" for={inputId}>Folder Name</label>
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
        <Button type="submit" variant="primary" disabled={saving || !draft.trim()}>
          {saving ? "Saving..." : "Save"}
        </Button>
        <Button disabled={saving} onclick={cancel}>Cancel</Button>
      </div>
    </form>
  {:else}
    {#if expanded}<div class="current-name" title={name}><Folder /><span>{name}</span></div>{/if}
    <Button icon={Pencil} onclick={startEditing}>Rename Folder</Button>
  {/if}
  {#if errorMessage}
    <div class="error"><StatusMessage tone="error">{errorMessage}</StatusMessage></div>
  {/if}
</div>

<style>
  .folder-name-editor {
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
    margin: 0;
  }

  .editing .title-actions {
    grid-column: 2;
    grid-row: 1;
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
    font-size: var(--text-xl);
    font-weight: 600;
    color: var(--color-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .title-actions {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
  }

  form {
    text-align: left;
  }

  .current-name {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;
    font-weight: 600;
  }

  .current-name :global(svg) {
    color: var(--color-brand);
  }

  .current-name span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
    line-height: inherit;
  }

  input[type="text"].title-input {
    font-size: var(--text-lg);
    font-weight: 600;
  }

  .error {
    margin-top: 8px;
    text-align: left;
    overflow-wrap: anywhere;
  }

  @media (max-width: 768px) {
    .folder-meta {
      justify-content: center;
    }

    .editing .folder-meta {
      justify-content: flex-start;
    }

    .title-form {
      flex-direction: column;
      gap: 16px;
      text-align: center;
    }

    .title-form.editing {
      text-align: left;
    }

    .title-details {
      width: 100%;
    }

    .title-actions {
      justify-content: center;
      flex-wrap: wrap;
    }

    .folder-title {
      font-size: var(--text-lg);
    }

    .edit-controls {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    }

    input[type="text"] {
      grid-column: 1 / -1;
    }

    .my > :global(.button) {
      width: 100%;
    }
  }
</style>
