<script lang="ts">
  import CircleCheck from "phosphor-svelte/lib/CheckCircleIcon";
  import CircleX from "phosphor-svelte/lib/XCircleIcon";
  import Info from "phosphor-svelte/lib/InfoIcon";
  import LoaderCircle from "phosphor-svelte/lib/CircleNotchIcon";
  import type { IconComponentProps } from "phosphor-svelte";
  import type { Component, Snippet } from "svelte";

  interface Props {
    tone?: "info" | "progress" | "success" | "error";
    // Replaces the tone's icon, for a message such as a warning.
    icon?: Component<IconComponentProps>;
    // A message that is part of the page rather than an update to it is a note.
    role?: "status" | "note";
    children: Snippet;
  }

  let { tone = "info", icon, role = "status", children }: Props = $props();

  const icons = { info: Info, progress: LoaderCircle, success: CircleCheck, error: CircleX };
  const Icon = $derived(icon ?? icons[tone]);
</script>

<p class={["status", tone]} {role}>
  <Icon />
  <span>{@render children()}</span>
</p>

<style>
  .status {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    margin: 0;
    padding: 10px 14px;
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    font-size: var(--text-md);
    line-height: 1.6;
  }

  /* Centers the icon on the first line of text. */
  .status :global(svg) {
    margin-top: calc((1.6em - 1.15em) / 2);
  }

  .status :global(strong) {
    font-weight: 600;
  }

  .info {
    background: var(--color-surface-inset);
    border-color: var(--color-border);
    color: var(--color-text-secondary);
  }

  .progress {
    background: var(--color-accent-subtle);
    border-color: var(--color-accent-border);
    color: var(--color-accent-text);
  }

  .progress :global(svg) {
    animation: spin 1s linear infinite;
  }

  .success {
    background: var(--color-success-subtle);
    border-color: var(--color-success-border);
    color: var(--color-success-text);
  }

  .error {
    background: var(--color-danger-subtle);
    border-color: var(--color-danger-border);
    color: var(--color-danger-text);
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
