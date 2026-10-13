<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    title: string;
    description?: string;
    actions?: Snippet;
  }

  let { title, description, actions }: Props = $props();
</script>

<header class="page-header">
  <div class="heading">
    <h2>{title}</h2>
    {#if description}<p>{description}</p>{/if}
  </div>
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
    margin-bottom: 4px;
  }

  .heading {
    min-width: 0;
  }

  h2 {
    margin: 0;
    font-size: var(--text-3xl);
    font-weight: 700;
    line-height: 1.25;
    letter-spacing: -0.025em;
    color: var(--color-text);
  }

  p {
    margin: 4px 0 0;
    font-size: var(--text-base);
    color: var(--color-text-secondary);
  }

  .actions {
    display: flex;
    flex-shrink: 0;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 8px;
  }

  .actions :global(.button) {
    white-space: nowrap;
  }

  @media (max-width: 768px) {
    .page-header {
      flex-direction: column;
      align-items: stretch;
    }

    h2 {
      font-size: var(--text-2xl);
    }

    /* Buttons share a row while they fit and take a full row each when they do not. */
    .actions > :global(*) {
      flex: 1 1 auto;
    }
  }
</style>
