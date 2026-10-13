<script lang="ts">
  import CloudUpload from "phosphor-svelte/lib/CloudArrowUpIcon";
  import Mail from "phosphor-svelte/lib/EnvelopeSimpleIcon";
  import GithubLogo from "phosphor-svelte/lib/GithubLogoIcon";
  import IconContext from "phosphor-svelte/lib/IconContext";
  import Terminal from "phosphor-svelte/lib/TerminalWindowIcon";
  import Button from "$lib/components/Button.svelte";
  import ConfirmDialog from "$lib/components/ConfirmDialog.svelte";
  import ThemeToggle from "$lib/components/ThemeToggle.svelte";

  let { children } = $props();
</script>

<!-- Icons decorate text unless a control asks for the outlined weight. -->
<IconContext values={{ weight: "fill", class: "icon", "aria-hidden": "true" }}>
  <div class="app">
    <header class="header">
      <div class="container header-content">
        <a href="/app" class="logo">
          <span class="logo-mark"><CloudUpload /></span>
          <h1>Minchan's Upload</h1>
        </a>
        <nav class="nav">
          <Button
            variant="ghost"
            href="https://github.com/kmc7468/upload"
            target="_blank"
            rel="noopener noreferrer"
            icon={GithubLogo}
            aria-label="GitHub"
          >
            <span class="nav-label">GitHub</span>
          </Button>
          <Button variant="ghost" href="mailto:me@minchan.me" icon={Mail} aria-label="Contact">
            <span class="nav-label">Contact</span>
          </Button>
          <ThemeToggle />
        </nav>
      </div>
    </header>
    <main class="container main-content">
      {@render children?.()}
    </main>
    <footer class="footer">
      <div class="container footer-content">
        <p class="copyright">© 2024-2026 Minchan Kim. All rights reserved.</p>
        <Button
          variant="ghost"
          size="sm"
          href="/install.sh"
          target="_blank"
          rel="noopener noreferrer"
          icon={Terminal}
          class="install-button"
        >
          Linux CLI Tool
        </Button>
      </div>
    </footer>
  </div>

  <ConfirmDialog />
</IconContext>

<style>
  /* The main content grows so the footer stays at the bottom of short pages. */
  .app {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }

  .container {
    width: 100%;
    max-width: 848px;
    margin: 0 auto;
    padding-inline: 24px;
  }

  /* The page shows through the header, blurred, as it scrolls underneath. */
  .header {
    position: sticky;
    top: 0;
    z-index: 100;
    border-bottom: 1px solid var(--color-border);
    background: var(--color-bg);
    background: color-mix(in srgb, var(--color-bg) 80%, transparent);
    backdrop-filter: saturate(180%) blur(12px);
  }

  .header-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    height: 60px;
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    color: var(--color-text);
  }

  .logo:hover {
    text-decoration: none;
  }

  .logo-mark {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    border-radius: var(--radius-md);
    background: var(--gradient-brand);
    color: #ffffff;
    font-size: 17px;
  }

  .logo-mark :global(svg) {
    width: 1em;
    height: 1em;
  }

  h1 {
    margin: 0;
    font-size: var(--text-base);
    font-weight: 700;
    letter-spacing: -0.01em;
    white-space: nowrap;
  }

  .nav {
    display: flex;
    gap: 4px;
  }

  .main-content {
    flex: 1;
    padding-top: 32px;
    padding-bottom: 64px;
  }

  .footer {
    border-top: 1px solid var(--color-border);
  }

  .footer-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    min-height: 64px;
  }

  .copyright {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--color-text-muted);
  }

  /* Ghost buttons line up with the content edge rather than with their padding. */
  .footer-content :global(.install-button) {
    margin-right: -10px;
  }

  .nav :global(.button:last-child) {
    margin-right: -10px;
  }

  @media (max-width: 768px) {
    .container {
      padding-inline: 16px;
    }

    .nav-label {
      display: none;
    }

    .nav :global(.button) {
      width: 36px;
      padding: 0;
    }

    .main-content {
      padding-top: 24px;
      padding-bottom: 48px;
    }

    /* Phones rarely have a terminal at hand. */
    .footer-content {
      justify-content: center;
      padding-top: 20px;
      padding-bottom: 20px;
      text-align: center;
    }

    .footer-content :global(.install-button) {
      display: none;
    }
  }
</style>
