<script lang="ts">
  import type { IconComponentProps } from "phosphor-svelte";
  import type { Component, Snippet } from "svelte";

  interface Props {
    icon?: Component<IconComponentProps>;
    title?: string;
    description?: string | Snippet;
    class?: string;
    children?: Snippet;
  }

  let { icon: Icon, title, description, class: className, children }: Props = $props();
</script>

<section class={["card", className]}>
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
    font-size: var(--text-base);
    font-weight: 600;
    line-height: 1.5;
    color: var(--color-text);
  }

  h3 :global(svg) {
    color: var(--color-accent-text);
  }

  p {
    margin: 4px 0 0;
    font-size: var(--text-md);
    line-height: 1.6;
    color: var(--color-text-secondary);
  }
</style>
