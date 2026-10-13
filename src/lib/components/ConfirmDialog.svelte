<script lang="ts">
  import TriangleAlert from "phosphor-svelte/lib/WarningIcon";
  import { confirmation } from "$lib/confirm.svelte";
  import Button from "./Button.svelte";

  let dialog: HTMLDialogElement;

  $effect(() => {
    if (confirmation.request && !dialog.open) {
      dialog.returnValue = "";
      dialog.showModal();
    }
  });

  // Escape, the Cancel button and the confirm button all close the dialog here.
  const finish = () => {
    const request = confirmation.request;
    confirmation.request = undefined;
    request?.resolve(dialog.returnValue === "confirm");
  };
</script>

<dialog bind:this={dialog} onclose={finish} aria-labelledby="confirm-title">
  {#if confirmation.request}
    {@const { title, message, confirmLabel, danger } = confirmation.request}
    <form method="dialog">
      <h3 id="confirm-title" class:danger>
        {#if danger}<TriangleAlert />{/if}{title}
      </h3>
      <p>{message}</p>
      <div class="actions">
        <Button type="submit" value="cancel">Cancel</Button>
        <Button type="submit" value="confirm" variant={danger ? "danger" : "primary"}>
          {confirmLabel}
        </Button>
      </div>
    </form>
  {/if}
</dialog>

<style>
  dialog {
    width: min(440px, calc(100% - 32px));
    padding: 24px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-surface-solid);
    color: var(--color-text);
    box-shadow: var(--shadow-md);
  }

  dialog::backdrop {
    background: rgba(30, 27, 75, 0.45);
    backdrop-filter: blur(2px);
  }

  h3 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 8px;
    font-size: var(--text-xl);
    font-weight: 600;
  }

  h3.danger {
    color: var(--color-danger-strong);
  }

  p {
    margin: 0 0 24px;
    font-size: var(--text-md);
    line-height: 1.6;
    color: var(--color-text-secondary);
    overflow-wrap: anywhere;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }

  @media (max-width: 480px) {
    .actions > :global(*) {
      flex: 1;
    }
  }
</style>
