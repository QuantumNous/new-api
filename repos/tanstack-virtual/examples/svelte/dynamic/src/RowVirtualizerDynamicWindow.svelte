<script lang="ts">
  import { faker } from '@faker-js/faker'
  import { createWindowVirtualizer } from '@tanstack/svelte-virtual'

  let virtualListEl: HTMLDivElement
  let virtualItemEls: HTMLDivElement[] = []

  function randomNumber(min: number, max: number) {
    return faker.number.int({ min, max })
  }

  const sentences = new Array(10000)
    .fill(true)
    .map(() => faker.lorem.sentence(randomNumber(20, 70)))

  const count = sentences.length

  $: virtualizer = createWindowVirtualizer<HTMLDivElement>({
    count,
    scrollMargin: virtualListEl?.offsetTop ?? 0,
    estimateSize: () => 45,
  })

  $: items = $virtualizer.getVirtualItems()

  $: {
    if (virtualItemEls.length)
      virtualItemEls.forEach((el) => $virtualizer.measureElement(el))
  }
</script>

<div>
  <div class="list scroll-container" bind:this={virtualListEl}>
    <div
      style="position: relative; height: {$virtualizer.getTotalSize()}px; width: 100%;"
    >
      <div
        style="position: absolute; top: 0; left: 0; width: 100%; transform: translateY({items[0]
          ? items[0].start - $virtualizer.options.scrollMargin
          : 0}px);"
      >
        {#each items as row, idx (row.index)}
          <div
            bind:this={virtualItemEls[idx]}
            data-index={row.index}
            class:list-item-even={row.index % 2 === 0}
            class:list-item-odd={row.index % 2 === 1}
          >
            <div style="padding: 10px 0;">
              <div>Row {row.index}</div>
              <div>{sentences[row.index]}</div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>
</div>
