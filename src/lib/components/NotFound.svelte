<script lang="ts">
  import CircleX from "phosphor-svelte/lib/XCircleIcon";
  import Files from "phosphor-svelte/lib/FilesIcon";
  import Upload from "phosphor-svelte/lib/UploadSimpleIcon";
  import Button from "./Button.svelte";

  let { title, message }: { title: string; message: string } = $props();
</script>

<section class="card not-found">
  <span class="tile lg danger"><CircleX /></span>
  <div class="content">
    <h3>{title}</h3>
    <p>{message}</p>
    <div class="actions">
      <Button variant="primary" href="/app" icon={Upload}>Upload Files</Button>
      <Button href="/app/my" icon={Files}>My Files</Button>
    </div>
  </div>
</section>

<style>
  .not-found {
    display: flex;
    align-items: flex-start;
    gap: 16px;
  }

  .content {
    min-width: 0;
  }

  h3 {
    margin: 0 0 2px;
    font-size: var(--text-lg);
    font-weight: 600;
    line-height: 1.4;
    letter-spacing: -0.01em;
    color: var(--color-text);
  }

  p {
    margin: 0 0 16px;
    font-size: var(--text-md);
    color: var(--color-text-secondary);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
</style>
