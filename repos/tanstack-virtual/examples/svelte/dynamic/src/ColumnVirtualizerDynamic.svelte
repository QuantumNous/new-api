<script lang="ts">
  import { faker } from '@faker-js/faker'
  import { createVirtualizer } from '@tanstack/svelte-virtual'

  let virtualListEl: HTMLDivElement
  let virtualItemEls: HTMLDivElement[] = []

  function randomNumber(min: number, max: number) {
    return faker.number.int({ min, max })
  }

  const sentences = new Array(10000)
    .fill(true)
    .map(() => faker.lorem.sentence(randomNumber(20, 70)))

  $: virtualizer = createVirtualizer<HTMLDivElement, HTMLDivElement>({
    horizontal: true,
    count: sentences.length,
    getScrollElement: () => virtualListEl,
    estimateSize: () => 45,
  })

  $: {
    if (virtualItemEls.length)
      virtualItemEls.forEach((el) => $virtualizer.measureElement(el))
  }
</script>

<div class="list scroll-container" bind:this={virtualListEl}>
  <div
    style="position: relative; height: 100%; width: {$virtualizer.getTotalSize()}px;"
  >
    {#each $virtualizer.getVirtualItems() as col, idx (col.index)}
      <div
        bind:this={virtualItemEls[idx]}
        data-index={col.index}
        class:list-item-even={col.index % 2 === 0}
        class:list-item-odd={col.index % 2 === 1}
        style="position: absolute; top: 0; left: 0; height: 100%; transform: translateX({col.start}px);"
      >
        <div style="width: {sentences[col.index].length}px">
          <div>Column {col.index}</div>
          <div>{sentences[col.index]}</div>
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .scroll-container {
    height: 400px;
    width: 400px;
    overflow: auto;
  }
</style>
