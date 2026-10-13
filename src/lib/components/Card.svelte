<script lang="ts">
  import type { IconComponentProps } from "phosphor-svelte";
  import type { Component, Snippet } from "svelte";

  interface Props {
    icon?: Component<IconComponentProps>;
    title?: string;
    description?: string | Snippet;
    tone?: "default" | "danger";
    class?: string;
    children?: Snippet;
  }

  let {
    icon: Icon,
    title,
    description,
    tone = "default",
    class: className,
    children,
  }: Props = $props();
</script>

<section class={["card", tone, className]}>
  {#if title}
    <header>
      <h3>
        {#if Icon}<Icon />{/if}{title}
      </h3>
      {#if typeof description === "string"}
        <p>{description}</p>
      {:else if description}
        <p>{@render description()}</p>
      {/if}
    </header>
  {/if}
  {@render children?.()}
</section>

<style>
  header {
    margin-bottom: 20px;
  }

  header:last-child {
    margin-bottom: 0;
  }

  h3 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: var(--text-xl);
    font-weight: 600;
    color: var(--color-text);
  }

  h3 :global(svg) {
    color: var(--color-brand);
  }

  p {
    margin: 6px 0 0;
    font-size: var(--text-md);
    line-height: 1.6;
    color: var(--color-text-secondary);
  }

  .danger {
    background: rgba(254, 242, 242, 0.95);
    border-color: var(--color-danger-border);
  }

  .danger h3,
  .danger h3 :global(svg) {
    color: var(--color-danger-strong);
  }

  .danger p {
    color: var(--color-danger-strong);
  }
</style>
