<script setup lang="ts">
import { computed, useAttrs, useId } from 'vue'

// Keep consumer `class`/`style` on the sizing wrapper, but forward everything
// else (e.g. `id`, `aria-*`) to the real <input> so label/focus targeting works.
defineOptions({ inheritAttrs: false })

const model = defineModel<string>({ default: '' })

withDefaults(
  defineProps<{
    type?: string
    placeholder?: string
    autocomplete?: string
    readonly?: boolean
  }>(),
  { type: 'text', placeholder: '', autocomplete: 'off', readonly: false }
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
</script>

<template>
  <div
    class="pencil-underline relative"
    :class="attrs.class"
    :style="wrapperStyle"
    data-handdrawn="underline"
  >
    <div
      v-if="$slots.icon"
      class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
    >
      <slot name="icon" />
    </div>
    <input
      :id="inputId"
      v-model="model"
      :type="type"
      :placeholder="placeholder"
      :autocomplete="autocomplete"
      :readonly="readonly"
      v-bind="inputAttrs"
      class="h-11 w-full border-0 border-b-[1.5px] bg-transparent pr-4 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] transition-[border-color] focus:outline-none focus:border-[var(--accent)]"
      style="border-color: var(--border-default)"
      :class="[
        $slots.icon ? 'pl-10' : 'pl-1',
        readonly ? 'cursor-not-allowed opacity-60' : '',
      ]"
    />
  </div>
</template>
