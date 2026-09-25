<script lang="ts">
  import { createVirtualizer } from '@tanstack/svelte-virtual'

  let virtualListEl: HTMLDivElement

  $: virtualizer = createVirtualizer<HTMLDivElement, HTMLDivElement>({
    horizontal: true,
    count: 10000,
    getScrollElement: () => virtualListEl,
    estimateSize: () => 100,
    overscan: 5,
  })
</script>

<div class="list scroll-container" bind:this={virtualListEl}>
  <div
    style="position: relative; height: 100%; width: {$virtualizer.getTotalSize()}px;"
  >
    {#each $virtualizer.getVirtualItems() as col (col.index)}
      <div
        class:list-item-even={col.index % 2 === 0}
        class:list-item-odd={col.index % 2 === 1}
        style="position: absolute; top: 0; left: 0; width: {col.size}px; height: 100%; transform: translateX({col.start}px);"
      >
        Column {col.index}
      </div>
    {/each}
  </div>
</div>

<style>
  .scroll-container {
    height: 100px;
    width: 400px;
    overflow: auto;
  }
</style>
