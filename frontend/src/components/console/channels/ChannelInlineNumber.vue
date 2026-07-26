<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  value: number
  label: string
  busy: boolean
  commit: (value: number) => Promise<boolean>
}>()

const draft = ref(String(props.value))
let cancelled = false

watch(
  () => props.value,
  (value) => {
    draft.value = String(value)
  }
)

async function commitDraft() {
  if (cancelled) {
    cancelled = false
    draft.value = String(props.value)
    return
  }
  const value = Number(draft.value)
  if (
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > 1_000_000 ||
    value === props.value
  ) {
    draft.value = String(props.value)
    return
  }
  if (!(await props.commit(value))) draft.value = String(props.value)
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    event.preventDefault()
    ;(event.currentTarget as HTMLInputElement).blur()
  } else if (event.key === 'Escape') {
    event.preventDefault()
    cancelled = true
    draft.value = String(props.value)
    ;(event.currentTarget as HTMLInputElement).blur()
  }
}
</script>

<template>
  <input
    v-model="draft"
    type="number"
    inputmode="numeric"
    min="0"
    max="1000000"
    step="1"
    :aria-label="label"
    :disabled="busy"
    class="h-8 w-[72px] rounded-lg border border-[var(--border-default)] bg-[var(--surface-solid)] px-2 text-center font-mono text-xs tabular-nums text-[var(--text-primary)] transition-colors focus:border-[var(--border-strong)] focus-ring disabled:cursor-wait disabled:opacity-60"
    @blur="commitDraft"
    @keydown="onKeydown"
  />
</template>
