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
    // "upload" shows the name with a Rename Folder button; "folder" is the heading of the
    // folder page; "my" shows only the form, opened by calling startEditing.
    variant?: "upload" | "folder" | "my";
    onsave?: (name: string) => void;
  } = $props();
  let editing = $state(false);
  let draft = $state("");
  let saving = $state(false);
  let errorMessage = $state("");
  const inputId = $props.id();
  let nameInput = $state<HTMLInputElement>();

  export const startEditing = async () => {
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

{#snippet editActions()}
  <Button type="submit" variant="primary" disabled={saving || !draft.trim()}>
    {saving ? "Saving..." : "Save"}
  </Button>
  <Button disabled={saving} onclick={cancel}>Cancel</Button>
{/snippet}

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class={["folder-name-editor", variant]}
  onclick={(event) => event.stopPropagation()}
  onkeydown={(event) => {
    event.stopPropagation();
    if (event.key === "Escape") cancel();
  }}
>
  {#if variant === "folder"}
    <form
      class="file-info-card"
      onsubmit={(event) => {
        event.preventDefault();
        if (editing) save();
      }}
    >
      <span class="tile lg"><Folder /></span>
      <div class="file-details">
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
          <h3 class="file-name">{name}</h3>
        {/if}
        <div class="meta-row">
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
        <div class="actions">
          {#if editing}
            {@render editActions()}
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
        {@render editActions()}
      </div>
    </form>
  {:else if variant === "upload"}
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

  /* Nothing is shown in a list until the form is opened. */
  .my:empty {
    display: none;
  }

  .actions {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
  }

  /* The name and the field that replaces it take the same space. */
  .title-input {
    width: 100%;
    margin-bottom: 2px;
    font-size: var(--text-base);
    font-weight: 600;
  }

  .current-name {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    font-weight: 600;
  }

  .current-name :global(svg) {
    color: var(--color-accent-text);
  }

  .current-name span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .edit-controls {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    gap: 8px;
  }

  .edit-controls input {
    min-width: 0;
    width: 100%;
  }

  .error {
    margin-top: 12px;
    overflow-wrap: anywhere;
  }

  @media (max-width: 768px) {
    .actions {
      width: 100%;
    }

    .actions > :global(*) {
      flex: 1;
    }

    .edit-controls {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    }

    .edit-controls input {
      grid-column: 1 / -1;
    }

    .upload > :global(.button) {
      width: 100%;
    }
  }
</style>
