<script lang="ts">
  import Check from "phosphor-svelte/lib/CheckIcon";
  import Copy from "phosphor-svelte/lib/CopyIcon";
  import X from "phosphor-svelte/lib/XIcon";
  import type { IconComponentProps } from "phosphor-svelte";
  import { onDestroy, type Component } from "svelte";
  import Button from "./Button.svelte";

  interface Props {
    // A function is read when clicked, for text that depends on later input.
    text: string | (() => string);
    label?: string;
    icon?: Component<IconComponentProps>;
    variant?: "primary" | "secondary" | "subtle";
    size?: "md" | "sm";
    iconOnly?: boolean;
    block?: boolean;
    disabled?: boolean;
    title?: string;
    "aria-label"?: string;
  }

  let {
    text,
    label = "Copy Link",
    icon = Copy,
    variant = "secondary",
    size = "md",
    iconOnly = false,
    block = false,
    disabled = false,
    title,
    "aria-label": ariaLabel,
  }: Props = $props();

  let result = $state<"copied" | "failed">();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(typeof text === "function" ? text() : text);
      result = "copied";
    } catch {
      result = "failed";
    }
    clearTimeout(timer);
    timer = setTimeout(() => (result = undefined), 2000);
  };

  onDestroy(() => clearTimeout(timer));
</script>

<Button
  {variant}
  {size}
  {iconOnly}
  {block}
  {disabled}
  {title}
  aria-label={ariaLabel ?? (iconOnly ? label : undefined)}
  icon={result === "copied" ? Check : result === "failed" ? X : icon}
  onclick={copy}
>
  {result === "copied" ? "Copied" : result === "failed" ? "Copy Failed" : label}
</Button>
<span class="visually-hidden" role="status">
  {result === "copied" ? "Copied to clipboard." : result === "failed" ? "Could not copy." : ""}
</span>
