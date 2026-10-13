<script lang="ts">
  import { page } from "$app/state";
  import NotFound from "$lib/components/NotFound.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";

  // The page keeps the heading it has when the file or folder exists.
  const headings: Record<string, string> = {
    "/app/file/[id]": "Download File",
    "/app/folder/[id]": "Download Folder",
  };
  const heading = $derived(page.route.id ? headings[page.route.id] : undefined);

  // Pages that raise an error name what was missing; any other error gets a general text,
  // so internal messages are never shown.
  const notFound = $derived(page.status === 404);
  const title = $derived(
    page.error?.title ?? (notFound ? "Page Not Found" : "Something Went Wrong"),
  );
  const message = $derived(
    page.error?.title
      ? page.error.message
      : notFound
        ? "The requested page does not exist."
        : "An unexpected error occurred. Please try again later.",
  );
</script>

<svelte:head>
  <title>{title} - Minchan's Upload</title>
</svelte:head>

<div class="page">
  {#if heading}<PageHeader title={heading} />{/if}
  <NotFound {title} {message} />
</div>
