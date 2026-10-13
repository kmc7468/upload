<script lang="ts">
  import CircleCheck from "phosphor-svelte/lib/CheckCircleIcon";
  import CircleX from "phosphor-svelte/lib/XCircleIcon";
  import Info from "phosphor-svelte/lib/InfoIcon";
  import LoaderCircle from "phosphor-svelte/lib/CircleNotchIcon";
  import type { Snippet } from "svelte";

  interface Props {
    tone?: "info" | "progress" | "success" | "error";
    children: Snippet;
  }

  let { tone = "info", children }: Props = $props();

  const icons = { info: Info, progress: LoaderCircle, success: CircleCheck, error: CircleX };
  const Icon = $derived(icons[tone]);
</script>

<p class={["status", tone]} role="status">
  <Icon />
  <span>{@render children()}</span>
</p>

<style>
  .status {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin: 0;
    padding: 10px 14px;
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    font-size: var(--text-md);
    line-height: 1.5;
  }

  .status :global(svg) {
    margin-top: 0.15em;
  }

  /* Tints sit on an opaque base, so a message reads the same on a card or on the page. */
  .info {
    background: var(--color-surface-inset);
    border-color: var(--color-border);
    color: var(--color-text-secondary);
  }

  .progress {
    background:
      linear-gradient(var(--color-brand-subtle), var(--color-brand-subtle)),
      var(--color-surface-solid);
    border-color: var(--color-brand-border);
    color: var(--color-brand-strong);
  }

  .progress :global(svg) {
    animation: spin 1s linear infinite;
  }

  .success {
    background:
      linear-gradient(var(--color-success-subtle), var(--color-success-subtle)),
      var(--color-surface-solid);
    border-color: var(--color-success-border);
    color: var(--color-success);
  }

  .error {
    background:
      linear-gradient(var(--color-danger-subtle), var(--color-danger-subtle)),
      var(--color-surface-solid);
    border-color: var(--color-danger-border);
    color: var(--color-danger);
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .progress :global(svg) {
      animation: none;
    }
  }
</style>
