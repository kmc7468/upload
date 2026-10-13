<script lang="ts">
  import CloudUpload from "phosphor-svelte/lib/CloudArrowUpIcon";
  import Mail from "phosphor-svelte/lib/EnvelopeSimpleIcon";
  import GithubLogo from "phosphor-svelte/lib/GithubLogoIcon";
  import IconContext from "phosphor-svelte/lib/IconContext";
  import Terminal from "phosphor-svelte/lib/TerminalWindowIcon";
  import ConfirmDialog from "$lib/components/ConfirmDialog.svelte";

  let { children } = $props();
</script>

<!-- Icons decorate text unless a control asks for the outlined weight. -->
<IconContext values={{ weight: "fill", class: "icon", "aria-hidden": "true" }}>
  <div class="app">
    <header class="header">
      <div class="header-content">
        <a href="/app" class="title-link">
          <h1 class="title">
            <span class="title-icon"><CloudUpload /></span>
            Minchan's Upload
          </h1>
        </a>
        <nav class="header-nav">
          <a
            href="https://github.com/kmc7468/upload"
            target="_blank"
            rel="noopener noreferrer"
            class="nav-button github-button"
          >
            <GithubLogo weight="bold" />
            <span>GitHub</span>
          </a>
          <a href="mailto:me@minchan.me" class="nav-button email-button">
            <Mail weight="bold" />
            <span>Contact</span>
          </a>
        </nav>
      </div>
    </header>
    <main class="main-content">
      {@render children?.()}
    </main>
    <footer class="footer">
      <div class="footer-content">
        <div class="footer-info">
          <p class="copyright">© 2024-2026 Minchan Kim. All rights reserved.</p>
        </div>
        <div class="footer-actions">
          <a href="/install.sh" class="install-button" target="_blank" rel="noopener noreferrer">
            <Terminal weight="bold" />
            Linux CLI Tool
          </a>
        </div>
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

  .header {
    background: var(--color-surface);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.2);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
    position: sticky;
    top: 0;
    z-index: 100;
  }

  .header-content {
    max-width: 848px;
    margin: 0 auto;
    padding: 0 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 80px;
  }

  .title {
    margin: 0;
    font-size: var(--text-2xl);
    font-weight: 700;
    color: var(--color-text);
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .title-icon {
    display: flex;
    font-size: 28px;
    color: var(--color-brand);
  }

  .title-link {
    text-decoration: none;
    color: inherit;
    transition: all var(--transition);
  }

  .title-link:hover {
    transform: translateY(-1px);
    filter: brightness(1.1);
  }

  .title-link:hover .title {
    color: var(--color-brand);
  }

  .header-nav {
    display: flex;
    gap: 12px;
  }

  .nav-button {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    border-radius: var(--radius-md);
    background: var(--color-brand-subtle);
    color: var(--color-brand);
    text-decoration: none;
    font-weight: 600;
    font-size: var(--text-md);
    transition: all var(--transition);
    border: 1px solid var(--color-brand-border);
  }

  .nav-button :global(svg) {
    width: 18px;
    height: 18px;
  }

  .nav-button:hover {
    background: var(--color-brand);
    color: var(--color-text-inverse);
    text-decoration: none;
    transform: translateY(-1px);
    box-shadow: var(--shadow-brand);
  }

  .main-content {
    flex: 1;
    max-width: 848px;
    margin: 0 auto;
    padding: 24px;
    width: 100%;
  }

  .footer {
    margin-top: 32px;
    padding: 24px 0;
    border-top: 1px solid rgba(255, 255, 255, 0.2);
  }

  .footer-content {
    max-width: 848px;
    margin: 0 auto;
    padding: 0 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 16px;
  }

  .footer-info {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .copyright {
    margin: 0;
    color: rgba(255, 255, 255, 0.7);
    font-size: var(--text-md);
    font-weight: 500;
  }

  .footer-actions {
    display: flex;
    gap: 12px;
  }

  .install-button {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: var(--radius-sm);
    text-decoration: none;
    font-size: var(--text-md);
    font-weight: 500;
    transition: all var(--transition);
    backdrop-filter: blur(10px);
  }

  .install-button:hover {
    background: rgba(255, 255, 255, 0.2);
    border-color: rgba(255, 255, 255, 0.3);
    transform: translateY(-1px);
    color: var(--color-text-inverse);
    text-decoration: none;
  }

  @media (max-width: 768px) {
    .header-content {
      padding: 0 16px;
      height: 65px;
    }

    .title {
      font-size: var(--text-xl);
    }

    .title-link:hover {
      transform: none;
    }

    .title-icon {
      font-size: 24px;
    }

    .nav-button {
      padding: 8px;
      font-size: var(--text-sm);
    }

    .nav-button span {
      display: none;
    }

    .main-content {
      padding: 24px 16px;
    }

    .footer-content {
      padding: 0 16px;
      flex-direction: column;
      text-align: center;
      gap: 12px;
    }

    .footer-info {
      order: 1;
    }

    .footer-actions {
      display: none;
    }
  }

  @media (max-width: 480px) {
    .header-content {
      flex-direction: row;
      height: 60px;
      padding: 12px 16px;
      gap: 0;
    }

    .title {
      font-size: var(--text-lg);
    }

    .title-icon {
      font-size: 20px;
    }

    .header-nav {
      display: flex;
    }

    .nav-button {
      min-width: 40px;
      padding: 8px;
      justify-content: center;
    }

    .main-content {
      padding: 20px 16px;
    }
  }
</style>
