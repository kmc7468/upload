<script lang="ts">
  import type { IconComponentProps } from "phosphor-svelte";
  import type { Component, Snippet } from "svelte";
  import type { HTMLAnchorAttributes, HTMLButtonAttributes } from "svelte/elements";

  type Props = HTMLButtonAttributes &
    Omit<HTMLAnchorAttributes, "type"> & {
      // One primary action per card; secondary for the rest, subtle inside lists.
      variant?: "primary" | "secondary" | "subtle" | "danger";
      size?: "md" | "sm";
      icon?: Component<IconComponentProps>;
      // Shows only the icon; pass an aria-label to name the button.
      iconOnly?: boolean;
      // Stretches to the width of its container.
      block?: boolean;
      children?: Snippet;
    };

  let {
    variant = "secondary",
    size = "md",
    icon: Icon,
    iconOnly = false,
    block = false,
    href,
    disabled = false,
    type = "button",
    class: className,
    children,
    ...rest
  }: Props = $props();

  const classes = $derived(["button", variant, size, { block, "icon-only": iconOnly }, className]);
</script>

{#if href !== undefined}
  <!-- Without an href, a disabled link can be neither followed nor focused. -->
  <a
    {...rest}
    href={disabled ? undefined : href}
    aria-disabled={disabled || undefined}
    class={classes}
  >
    {#if Icon}<Icon weight="bold" />{/if}
    {#if !iconOnly}{@render children?.()}{/if}
  </a>
{:else}
  <button {...rest} {type} {disabled} class={classes}>
    {#if Icon}<Icon weight="bold" />{/if}
    {#if !iconOnly}{@render children?.()}{/if}
  </button>
{/if}

<style>
  .button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 42px;
    padding: 10px 18px;
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    font-size: var(--text-md);
    font-weight: 600;
    line-height: 1.4;
    text-align: center;
    text-decoration: none;
    cursor: pointer;
    transition:
      transform var(--transition),
      box-shadow var(--transition),
      background var(--transition),
      border-color var(--transition),
      color var(--transition);
  }

  .button:hover {
    text-decoration: none;
  }

  .sm {
    gap: 6px;
    min-height: 34px;
    padding: 6px 12px;
    border-radius: var(--radius-sm);
    font-size: var(--text-sm);
  }

  .icon-only {
    width: 42px;
    padding: 0;
  }

  .sm.icon-only {
    width: 34px;
  }

  .block {
    display: flex;
    width: 100%;
  }

  .primary {
    background: var(--gradient-brand);
    color: var(--color-text-inverse);
    box-shadow: var(--shadow-brand);
  }

  .secondary {
    background: var(--color-surface-solid);
    border-color: var(--color-border);
    color: var(--color-text);
    box-shadow: var(--shadow-sm);
  }

  .subtle {
    background: var(--color-brand-subtle);
    border-color: var(--color-brand-border);
    color: var(--color-brand-strong);
  }

  .danger {
    background: var(--color-danger-subtle);
    border-color: var(--color-danger-border);
    color: var(--color-danger);
  }

  .primary:not(:disabled, [aria-disabled="true"]):hover {
    transform: translateY(-1px);
    box-shadow: var(--shadow-brand-hover);
    color: var(--color-text-inverse);
  }

  .secondary:not(:disabled, [aria-disabled="true"]):hover {
    border-color: var(--color-brand);
    color: var(--color-brand-strong);
  }

  .subtle:not(:disabled, [aria-disabled="true"]):hover {
    border-color: var(--color-brand);
  }

  .danger:not(:disabled, [aria-disabled="true"]):hover {
    border-color: var(--color-danger);
  }

  .button:disabled,
  .button[aria-disabled="true"] {
    opacity: 0.5;
    cursor: not-allowed;
    box-shadow: none;
  }
</style>
