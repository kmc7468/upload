<script lang="ts">
  import { page } from "$app/state";

  // What messengers and social sites show when a link to the page is shared.
  let { title, description }: { title: string; description: string } = $props();
</script>

<svelte:head>
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Minchan's Upload" />
  <meta property="og:url" content={page.url.href} />
  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
</svelte:head>
