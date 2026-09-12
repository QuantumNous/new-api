<template>
  <div>
    <button id="button" type="button" @click="count++">
      count: {{ count }} foo: {{ props.foo }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{
  foo: string;
}>();

const count = ref<number>(0);
</script>
