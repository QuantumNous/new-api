<script setup lang="ts">
export interface TabItem {
  key: string
  label: string
}

const model = defineModel<string>({ default: '' })

const props = defineProps<{
  items: TabItem[]
  panelId: string
}>()

function onKeydown(e: KeyboardEvent, index: number) {
  let next: number
  if (e.key === 'ArrowRight') {
    next = index === props.items.length - 1 ? 0 : index + 1
  } else if (e.key === 'ArrowLeft') {
    next = index === 0 ? props.items.length - 1 : index - 1
  } else if (e.key === 'Home') {
    next = 0
  } else if (e.key === 'End') {
    next = props.items.length - 1
  } else {
    return
  }

  const item = props.items[next]
  if (!item) return
  e.preventDefault()
  model.value = item.key
  const tabs = (
    e.currentTarget as HTMLElement
  ).parentElement?.querySelectorAll<HTMLElement>('[role="tab"]')
  tabs?.[next]?.focus()
}
</script>

<template>
  <div
    class="console-tabs flex items-center gap-7 border-b border-[var(--border-subtle)]"
    role="tablist"
    data-handdrawn="tabs"
  >
    <button
      v-for="(item, i) in items"
      :id="`${panelId}-tab-${item.key}`"
      :key="item.key"
      type="button"
      role="tab"
      :aria-controls="panelId"
      :aria-selected="model === item.key"
      :tabindex="model === item.key ? 0 : -1"
      class="relative pb-3 text-sm font-medium transition-colors"
      :class="
        model === item.key
          ? 'text-[var(--text-primary)]'
          : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
      "
      @click="model = item.key"
      @keydown="onKeydown($event, i)"
    >
      <!-- brush-highlight on active label -->
      <span
        :class="model === item.key ? 'brush-highlight' : ''"
        style="position: relative; z-index: 0"
        >{{ item.label }}</span
      >

      <!-- Active indicator: tapered brush-stroke bar (wider center, thin ends) -->
      <span
        v-if="model === item.key"
        class="active-bar absolute inset-x-0 -bottom-px"
        aria-hidden="true"
      />
    </button>
  </div>
</template>

<style scoped>
.console-tabs {
  scrollbar-width: none;
}
.console-tabs::-webkit-scrollbar {
  display: none;
}

/* Day: tapered brush-stroke bar (clip). Night: full-width gold bar + glow. */
.active-bar {
  height: 2.5px;
  background: var(--accent);
  border-radius: 9999px;
  clip-path: var(--tab-bar-clip, none);
  box-shadow: var(--tab-bar-glow, none);
}
</style>
