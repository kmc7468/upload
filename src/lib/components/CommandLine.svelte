<script lang="ts">
  import Terminal from "phosphor-svelte/lib/TerminalWindowIcon";
  import CopyButton from "./CopyButton.svelte";

  interface Props {
    command: string;
    // A word in the command that stands for the user's own value, such as "filename".
    placeholder?: string;
  }

  let { command, placeholder }: Props = $props();

  const parts = $derived(placeholder ? command.split(placeholder) : [command]);
</script>

<div class="command-line">
  <span class="label"><Terminal />Command Line</span>
  <div class="row">
    <code
      >{#each parts as part, index (index)}{#if index}<i>{placeholder}</i>{/if}{part}{/each}</code
    >
    <CopyButton text={command} label="Copy Command" iconOnly size="sm" />
  </div>
</div>

<style>
  .command-line {
    padding: 12px;
    background: var(--color-brand-faint);
    border: 1px solid var(--color-brand-border);
    border-radius: var(--radius-md);
  }

  .label {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--color-text-secondary);
  }

  .row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  code {
    flex: 1;
    display: block;
    padding: 7px 12px;
    background: var(--color-surface-inset);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
    line-height: 1.6;
    color: var(--color-text);
    white-space: nowrap;
    overflow-x: auto;
  }

  /* Phones rarely have a terminal at hand. */
  @media (max-width: 768px) {
    .command-line {
      display: none;
    }
  }
</style>
