<script lang="ts">
  import type { IconComponentProps } from "phosphor-svelte";
  import type { Component, Snippet } from "svelte";

  interface Props {
    icon: Component<IconComponentProps>;
    title: string;
    actions?: Snippet;
  }

  let { icon: Icon, title, actions }: Props = $props();
</script>

<header class="page-header">
  <h2><Icon />{title}</h2>
  {#if actions}
    <div class="actions">{@render actions()}</div>
  {/if}
</header>

<style>
  /* A little more room below the title than between the cards that follow. */
  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 8px;
  }

  h2 {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 0;
    font-size: var(--text-3xl);
    font-weight: 700;
    line-height: 1.3;
    color: var(--color-text-inverse);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 12px;
  }

  .actions :global(.button) {
    white-space: nowrap;
  }

  /* On the page background, buttons invert: solid white leads, translucent white follows. */
  .actions :global(.button.primary) {
    background: var(--color-surface-solid);
    color: var(--color-brand-strong);
    box-shadow: var(--shadow-md);
  }

  .actions :global(.button.primary:not(:disabled, [aria-disabled="true"]):hover) {
    color: var(--color-brand-accent);
  }

  .actions :global(.button.secondary) {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.4);
    color: var(--color-text-inverse);
    box-shadow: none;
  }

  .actions :global(.button.secondary:not(:disabled, [aria-disabled="true"]):hover) {
    background: rgba(255, 255, 255, 0.25);
    border-color: rgba(255, 255, 255, 0.6);
    color: var(--color-text-inverse);
  }

  @media (max-width: 768px) {
    .page-header {
      flex-direction: column;
      align-items: stretch;
    }

    h2 {
      flex-direction: column;
      gap: 8px;
      font-size: 28px;
      text-align: center;
    }

    /* Buttons share a row while they fit and take a full row each when they do not. */
    .actions > :global(*) {
      flex: 1 1 auto;
    }
  }

  @media (max-width: 480px) {
    h2 {
      font-size: var(--text-2xl);
    }
  }
</style>
