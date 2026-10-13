<script lang="ts">
  import CircleX from "phosphor-svelte/lib/XCircleIcon";
  import Files from "phosphor-svelte/lib/FilesIcon";
  import Upload from "phosphor-svelte/lib/UploadSimpleIcon";
  import Button from "./Button.svelte";

  let { title, message }: { title: string; message: string } = $props();
</script>

<section class="card not-found">
  <span class="icon"><CircleX /></span>
  <div>
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
    gap: 20px;
    padding: 32px;
  }

  .icon {
    flex-shrink: 0;
    font-size: 48px;
    line-height: 1;
    color: var(--color-danger);
  }

  h3 {
    margin: 0 0 6px;
    font-size: var(--text-2xl);
    font-weight: 700;
    color: var(--color-danger-strong);
  }

  p {
    margin: 0 0 20px;
    font-size: var(--text-base);
    color: var(--color-text-secondary);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }

  @media (max-width: 480px) {
    .not-found {
      flex-direction: column;
      align-items: center;
      padding: 24px;
      text-align: center;
    }

    .actions {
      justify-content: center;
    }
  }
</style>
