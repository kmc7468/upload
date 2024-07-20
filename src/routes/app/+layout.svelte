<div>
  <header>
    <h1>Minchan's Upload</h1>
    <aside><p>
      GitHub: <a href="https://github.com/kmc7468/upload">https://github.com/kmc7468/upload</a><br>
      Contact: <a href="mailto:me@minchan.me">me@minchan.me</a>
    </aside>
  </header>

  <slot />
</div>

<style>
  @media (min-width: 1280px) and (orientation: landscape) {
    div {
      width: 1280px;
      margin-left: calc((100% - 1280px) / 2);
    }
  }
</style>