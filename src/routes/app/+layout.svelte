<div>
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