<script lang="ts">
  import Eye from "phosphor-svelte/lib/EyeIcon";
  import EyeOff from "phosphor-svelte/lib/EyeSlashIcon";
  import type { HTMLInputAttributes } from "svelte/elements";

  let { value = $bindable(""), disabled, ...rest }: HTMLInputAttributes = $props();

  // A passphrase cannot be recovered, so it can be checked for typos before use.
  let visible = $state(false);
  let input: HTMLInputElement;

  export const focus = () => input.focus();
</script>

<div class="password-input">
  <input
    {...rest}
    bind:this={input}
    bind:value
    type={visible ? "text" : "password"}
    {disabled}
    autocomplete="off"
    spellcheck="false"
  />
  <button
    type="button"
    class="toggle"
    aria-label={visible ? "Hide passphrase" : "Show passphrase"}
    aria-pressed={visible}
    title={visible ? "Hide passphrase" : "Show passphrase"}
    {disabled}
    onclick={() => (visible = !visible)}
  >
    {#if visible}<EyeOff weight="bold" />{:else}<Eye weight="bold" />{/if}
  </button>
</div>

<style>
  .password-input {
    position: relative;
  }

  input {
    width: 100%;
    padding-right: 48px;
  }

  .toggle {
    position: absolute;
    top: 50%;
    right: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    padding: 0;
    border: none;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--color-text-secondary);
    transform: translateY(-50%);
    transition: color var(--transition);
  }

  .toggle:not(:disabled):hover {
    color: var(--color-brand);
  }

  .toggle:disabled {
    opacity: 0.5;
  }
</style>
