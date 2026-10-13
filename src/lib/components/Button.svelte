<script lang="ts">
  import type { IconComponentProps } from "phosphor-svelte";
  import type { Component, Snippet } from "svelte";
  import type { HTMLAnchorAttributes, HTMLButtonAttributes } from "svelte/elements";

  type Props = HTMLButtonAttributes &
    Omit<HTMLAnchorAttributes, "type"> & {
      // One primary action per card; secondary for the rest, ghost for quiet actions
      // such as those in a list. Danger confirms a destructive action, and danger-ghost
      // starts one.
      variant?: "primary" | "secondary" | "ghost" | "danger" | "danger-ghost";
      size?: "md" | "sm";
      icon?: Component<IconComponentProps>;
      // Shows only the icon, or the children when there is no icon; the aria-label names
      // the button and becomes its tooltip.
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
    title,
    children,
    ...rest
  }: Props = $props();

  const classes = $derived(["button", variant, size, { block, "icon-only": iconOnly }, className]);
  const tooltip = $derived(title ?? (iconOnly ? rest["aria-label"] : undefined));
</script>

{#if href !== undefined}
  <!-- Without an href, a disabled link can be neither followed nor focused. -->
  <a
    {...rest}
    href={disabled ? undefined : href}
    title={tooltip}
    aria-disabled={disabled || undefined}
    class={classes}
  >
    {#if Icon}<Icon weight="bold" />{/if}
    {#if !iconOnly || !Icon}{@render children?.()}{/if}
  </a>
{:else}
  <button {...rest} {type} {disabled} title={tooltip} class={classes}>
    {#if Icon}<Icon weight="bold" />{/if}
    {#if !iconOnly || !Icon}{@render children?.()}{/if}
  </button>
{/if}

<style>
  .button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 36px;
    padding: 7px 14px;
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    background: none;
    color: var(--color-text);
    font-size: var(--text-md);
    font-weight: 500;
    line-height: 1.4;
    text-align: center;
    text-decoration: none;
    cursor: pointer;
    transition:
      background var(--transition),
      border-color var(--transition),
      color var(--transition);
  }

  .button:hover {
    text-decoration: none;
  }

  .sm {
    min-height: 32px;
    padding: 5px 10px;
    border-radius: var(--radius-sm);
    font-size: var(--text-sm);
  }

  .icon-only {
    width: 36px;
    padding: 0;
  }

  .sm.icon-only {
    width: 32px;
  }

  .block {
    display: flex;
    width: 100%;
  }

  .primary {
    background: var(--color-accent);
    color: var(--color-on-accent);
    box-shadow: var(--shadow-xs);
  }

  .secondary {
    background: var(--color-control);
    border-color: var(--color-border);
    box-shadow: var(--shadow-xs);
  }

  .ghost,
  .danger-ghost {
    color: var(--color-text-secondary);
  }

  .danger {
    background: var(--color-danger);
    color: #ffffff;
    box-shadow: var(--shadow-xs);
  }

  .primary:not(:disabled, [aria-disabled="true"]):hover {
    background: var(--color-accent-hover);
    color: var(--color-on-accent);
  }

  .secondary:not(:disabled, [aria-disabled="true"]):hover {
    background: var(--color-surface-hover);
    border-color: var(--color-border-strong);
    color: var(--color-text);
  }

  .ghost:not(:disabled, [aria-disabled="true"]):hover {
    background: var(--color-surface-hover);
    color: var(--color-text);
  }

  .danger:not(:disabled, [aria-disabled="true"]):hover {
    background: var(--color-danger-hover);
    color: #ffffff;
  }

  .danger-ghost:not(:disabled, [aria-disabled="true"]):hover {
    background: var(--color-danger-subtle);
    color: var(--color-danger-text);
  }

  .button:disabled,
  .button[aria-disabled="true"] {
    opacity: 0.5;
    cursor: not-allowed;
    box-shadow: none;
  }
</style>
