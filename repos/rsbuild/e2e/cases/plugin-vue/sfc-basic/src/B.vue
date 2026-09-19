<template>
  <button id="button2" @click="count++">B: {{ count }}</button>
</template>

<script setup>
import { ref } from 'vue';

const count = ref(0);
</script>
