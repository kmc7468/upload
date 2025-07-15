<script lang="ts">
  let { children } = $props();
</script>

<div>
  <header class="header">
    <div class="header-content">
      <a href="/app" class="title-link">
        <h1 class="title">
          <span class="title-icon">📤</span>
          Minchan's Upload
        </h1>
      </a>
      <nav class="header-nav">
        <a href="https://github.com/kmc7468/upload" target="_blank" rel="noopener noreferrer" class="nav-button github-button">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
          <span>GitHub</span>
        </a>
        <a href="mailto:me@minchan.me" class="nav-button email-button">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
          </svg>
          <span>Contact</span>
        </a>
      </nav>
    </div>
  </header>
  <main class="main-content">
    {@render children?.()}
  </main>
</div>

<style>
  .header {
    background: rgba(255, 255, 255, 0.95);
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
    font-size: 24px;
    font-weight: 700;
    color: #333;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .title-icon {
    font-size: 28px;
  }

  .title-link {
    text-decoration: none;
    color: inherit;
    transition: all 0.3s ease;
  }

  .title-link:hover {
    transform: translateY(-1px);
    filter: brightness(1.1);
  }

  .title-link:hover .title {
    color: #667eea;
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
    border-radius: 12px;
    background: rgba(102, 126, 234, 0.1);
    color: #667eea;
    text-decoration: none;
    font-weight: 600;
    font-size: 14px;
    transition: all 0.3s ease;
    border: 1px solid rgba(102, 126, 234, 0.2);
  }

  .nav-button:hover {
    background: #667eea;
    color: white;
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(102, 126, 234, 0.3);
  }

  .main-content {
    flex: 1;
    max-width: 848px;
    margin: 0 auto;
    padding: 24px;
    width: 100%;
  }

  @media (max-width: 768px) {
    .header-content {
      padding: 0 16px;
      height: 65px;
    }

    .title {
      font-size: 20px;
    }

    .title-link:hover {
      transform: none;
    }

    .title-icon {
      font-size: 24px;
    }

    .nav-button {
      padding: 8px;
      font-size: 13px;
    }

    .nav-button span {
      display: none;
    }

    .main-content {
      padding: 24px 16px;
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
      font-size: 18px;
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