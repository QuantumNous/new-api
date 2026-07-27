<script setup lang="ts">
import { computed, useAttrs, useId } from 'vue'

defineOptions({ inheritAttrs: false })

const model = defineModel<number | null>({ default: null })

const props = withDefaults(
  defineProps<{
    placeholder?: string
    min?: number
    max?: number
  }>(),
  { placeholder: '', min: undefined, max: undefined }
)

const attrs = useAttrs()
const fallbackId = useId()
const inputId = computed(() => String(attrs.id ?? fallbackId))
const wrapperStyle = computed(() => attrs.style)
const inputAttrs = computed(() => {
  const rest = { ...attrs }
  delete rest.class
  delete rest.style
  delete rest.id
  return rest
})

function onInput(e: Event) {
  const input = e.target as HTMLInputElement
  const allowNegative = Number.isFinite(props.min) && Number(props.min) < 0
  const raw = input.value
    .replace(allowNegative ? /[^0-9.-]/g : /[^0-9.]/g, '')
    .replace(/(?!^)-/g, '')
    .replace(/(\..*)\./g, '$1')
  input.value = raw

  if (raw === '' || raw === '-' || raw === '.' || raw === '-.') {
    model.value = null
    return
  }

  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) {
    model.value = null
    return
  }

  // Only the max bound applies per keystroke. Clamping the min here would
  // rewrite "1" to the minimum while the user is still typing "15".
  const maximum = Number.isFinite(props.max) ? props.max : undefined
  const bounded = maximum !== undefined ? Math.min(maximum, parsed) : parsed
  if (bounded !== parsed) input.value = String(bounded)
  model.value = bounded
}

function onBlur(e: Event) {
  const minimum = Number.isFinite(props.min) ? props.min : undefined
  if (minimum === undefined || model.value === null) return
  if (model.value < minimum) {
    model.value = minimum
    ;(e.target as HTMLInputElement).value = String(minimum)
  }
}
</script>

<template>
  <div
    class="pencil-underline relative"
    :class="attrs.class"
    :style="wrapperStyle"
    data-handdrawn="underline"
  >
    <span
      class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-[var(--text-tertiary)]"
      >$</span
    >
    <input
      :id="inputId"
      :value="model ?? ''"
      inputmode="decimal"
      :min="min"
      :max="max"
      :placeholder="placeholder"
      v-bind="inputAttrs"
      class="h-11 w-full border-0 border-b-[1.5px] bg-transparent pl-8 pr-4 font-mono text-sm font-semibold text-[var(--text-primary)] placeholder:font-normal placeholder:font-sans placeholder:text-[var(--text-tertiary)] transition-[border-color] focus:outline-none focus:border-[var(--accent)]"
      style="border-color: var(--border-default)"
      @input="onInput"
      @blur="onBlur"
    />
  </div>
</template>
