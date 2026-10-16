<script setup lang="ts">
import { ref, toRefs } from 'vue'

const props = defineProps<{
  indeterminate: boolean
  className?: string
}>()

const { indeterminate, className } = toRefs(props)

const inputRef = ref<any>(null)
</script>

<template>
  <input
    type="checkbox"
    ref="inputRef"
    :class="`${className} cursor-pointer`"
    :indeterminate="indeterminate"
    v-bind="$attrs"
  />
</template>
