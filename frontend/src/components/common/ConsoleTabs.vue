<script setup lang="ts">
export interface TabItem {
  key: string
  label: string
}

const model = defineModel<string>({ default: '' })

const props = defineProps<{
  items: TabItem[]
}>()

function onKeydown(e: KeyboardEvent, index: number) {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
  e.preventDefault()
  const delta = e.key === 'ArrowRight' ? 1 : -1
  const next = (index + delta + props.items.length) % props.items.length
  model.value = props.items[next].key
  const tabs = (
    e.currentTarget as HTMLElement
  ).parentElement?.querySelectorAll<HTMLElement>('[role="tab"]')
  tabs?.[next]?.focus()
}
</script>

<template>
  <div
    class="flex items-center gap-7 border-b border-[var(--border-subtle)]"
    role="tablist"
  >
    <button
      v-for="(item, i) in items"
      :key="item.key"
      type="button"
      role="tab"
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
      >{{ item.label }}</span>

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
.active-bar {
  height: 2.5px;
  background: var(--accent);
  border-radius: 9999px;
  /* Clip-path creates a tapered "brush stroke": wide in the middle, thin at ends */
  clip-path: inset(0 8% round 9999px);
}
</style>
