<script lang="ts">
  import Moon from "phosphor-svelte/lib/MoonIcon";
  import Sun from "phosphor-svelte/lib/SunIcon";
  import { onMount } from "svelte";
  import Button from "./Button.svelte";

  // The script in app.html decides the theme; this only records a choice and follows it.
  let dark = $state(false);

  onMount(() => {
    const root = document.documentElement;
    const sync = () => (dark = root.dataset.theme === "dark");
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  });

  // The icon only turns once the button has been pressed, not when the page loads.
  let pressed = $state(false);

  const toggle = () => {
    pressed = true;
    const next = dark ? "light" : "dark";
    const system = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    try {
      // Choosing the system theme goes back to following the system.
      if (next === system) localStorage.removeItem("theme");
      else localStorage.setItem("theme", next);
    } catch {
      // Without storage, the choice lasts until the page is left.
    }
    const apply = () => window.dispatchEvent(new CustomEvent("themechange", { detail: next }));

    // The whole page fades from one theme to the other where the browser supports it.
    if (document.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches)
      document.startViewTransition(apply);
    else apply();
  };
</script>

<!-- Both icons are rendered and CSS shows the one for the current theme, so the icon is
     right from the first paint, before this component runs. -->
<Button
  variant="ghost"
  iconOnly
  class={["theme-toggle", { pressed }]}
  aria-label={dark ? "Switch to Light Theme" : "Switch to Dark Theme"}
  onclick={toggle}
>
  <Moon weight="bold" class="icon moon" />
  <Sun weight="bold" class="icon sun" />
</Button>

<style>
  :global(:root[data-theme="dark"] .theme-toggle .moon),
  :global(:root:not([data-theme="dark"]) .theme-toggle .sun) {
    display: none;
  }

  /* An icon starts its animation again whenever it is shown, so each switch turns the new
     icon in. */
  :global(.theme-toggle.pressed svg) {
    animation: turn-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @keyframes -global-turn-in {
    from {
      opacity: 0;
      transform: rotate(-90deg) scale(0.5);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    :global(.theme-toggle.pressed svg) {
      animation: none;
    }
  }
</style>
