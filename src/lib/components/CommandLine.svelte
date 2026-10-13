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

<section class="command-line" aria-label="Command Line">
  <div class="bar">
    <span class="label"><Terminal />Command Line</span>
    <CopyButton text={command} label="Copy Command" variant="ghost" iconOnly size="sm" />
  </div>
  <!-- The prompt is drawn by CSS, so it is neither copied nor read aloud. -->
  <code
    >{#each parts as part, index (index)}{#if index}<i>{placeholder}</i>{/if}{part}{/each}</code
  >
</section>

<style>
  /* A terminal window, dark in both themes */
  .command-line {
    overflow: hidden;
    background: var(--color-terminal);
    border: 1px solid var(--color-terminal-border);
    border-radius: var(--radius-lg);
  }

  .bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 4px 4px 14px;
    border-bottom: 1px solid var(--color-terminal-border);
  }

  .label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: var(--text-xs);
    font-weight: 500;
    color: var(--color-terminal-muted);
  }

  .bar :global(.button) {
    color: var(--color-terminal-muted);
  }

  .bar :global(.button:not(:disabled):hover) {
    background: var(--color-terminal-hover);
    color: var(--color-terminal-text);
  }

  code {
    display: block;
    padding: 14px 16px;
    overflow-x: auto;
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    line-height: 1.6;
    color: var(--color-terminal-text);
    white-space: nowrap;
  }

  code::before {
    content: "$";
    margin-right: 10px;
    color: var(--color-terminal-prompt);
  }

  i {
    color: var(--color-terminal-placeholder);
  }

  /* Phones rarely have a terminal at hand. */
  @media (max-width: 768px) {
    .command-line {
      display: none;
    }
  }
</style>
