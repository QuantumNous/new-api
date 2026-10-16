<script lang="ts">
  import {
    createVirtualizer,
    elementScroll,
    type VirtualizerOptions,
  } from '@tanstack/svelte-virtual'
  import { onMount } from 'svelte'

  let virtualListEl: HTMLDivElement
  let time = Date.now()
  let randomIndex = Math.floor(Math.random() * 10000)
  let scrollToFn: VirtualizerOptions<any, any>['scrollToFn'] = () => {}

  function easeInOutQuint(t: number) {
    return t < 0.5 ? 16 * t * t * t * t * t : 1 + 16 * --t * t * t * t * t
  }

  $: virtualizer = createVirtualizer<HTMLDivElement, HTMLDivElement>({
    count: 10000,
    getScrollElement: () => virtualListEl,
    estimateSize: () => 35,
    overscan: 5,
    scrollToFn,
  })

  onMount(() => {
    scrollToFn = (offset, canSmooth, instance) => {
      const duration = 1000
      const start = virtualListEl.scrollTop
      const startTime = (time = Date.now())

      function run() {
        if (time !== startTime) return
        const now = Date.now()
        const elapsed = now - startTime
        const progress = easeInOutQuint(Math.min(elapsed / duration, 1))
        const interpolated = start + (offset - start) * progress

        if (elapsed < duration) {
          elementScroll(interpolated, canSmooth, instance)
          requestAnimationFrame(run)
        } else {
          elementScroll(interpolated, canSmooth, instance)
        }
      }

      requestAnimationFrame(run)
    }
  })
</script>

<main>
  <p>
    This smooth scroll example uses the <code>`scrollToFn`</code> to implement a
    custom scrolling function for the methods like
    <code>`scrollToIndex`</code> and <code>`scrollToOffset`</code>
  </p>
  <br />
  <br />

  <div>
    <button
      on:click={() => {
        $virtualizer.scrollToIndex(randomIndex)
        randomIndex = Math.floor(Math.random() * 10000)
      }}
    >
      Scroll To Random Index ({randomIndex})
    </button>
  </div>

  <br />
  <br />

  <div class="list scroll-container" bind:this={virtualListEl}>
    <div
      style="position: relative; height: {$virtualizer.getTotalSize()}px; width: 100%;"
    >
      {#each $virtualizer.getVirtualItems() as row (row.index)}
        <div
          class:list-item-even={row.index % 2 === 0}
          class:list-item-odd={row.index % 2 === 1}
          style="position: absolute; top: 0; left: 0; width: 100%; height: {row.size}px; transform: translateY({row.start}px);"
        >
          Row {row.index}
        </div>
      {/each}
    </div>
  </div>
</main>

<style>
  .scroll-container {
    height: 200px;
    width: 400px;
    overflow: auto;
  }
</style>
