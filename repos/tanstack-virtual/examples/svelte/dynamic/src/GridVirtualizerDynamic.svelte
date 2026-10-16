<script lang="ts">
  import { createVirtualizer } from '@tanstack/svelte-virtual'

  let virtualListEl: HTMLDivElement

  $: rowVirtualizer = createVirtualizer<HTMLDivElement, HTMLDivElement>({
    count: 10000,
    getScrollElement: () => virtualListEl,
    estimateSize: () => 35,
    overscan: 5,
  })

  $: columnVirtualizer = createVirtualizer<HTMLDivElement, HTMLDivElement>({
    horizontal: true,
    count: 10000,
    getScrollElement: () => virtualListEl,
    estimateSize: () => 100,
    overscan: 5,
  })
</script>

<div class="list scroll-container" bind:this={virtualListEl}>
  <div
    style="position: relative; height: {$rowVirtualizer.getTotalSize()}px; width: {$columnVirtualizer.getTotalSize()}px;"
  >
    {#each $rowVirtualizer.getVirtualItems() as row (row.index)}
      {#each $columnVirtualizer.getVirtualItems() as col (col.index)}
        <div
          class={col.index % 2
            ? row.index % 2 === 0
              ? 'list-item-odd'
              : 'list-item-even'
            : row.index % 2
              ? 'list-item-odd'
              : 'list-item-even'}
          style="position: absolute; top: 0; left: 0; width: {col.size}px; height: {row.size}px; transform: translateX({col.start}px) translateY({row.start}px);"
        >
          Cell {row.index}, {col.index}
        </div>
      {/each}
    {/each}
  </div>
</div>

<style>
  .scroll-container {
    height: 500px;
    width: 500px;
    overflow: auto;
  }
</style>
