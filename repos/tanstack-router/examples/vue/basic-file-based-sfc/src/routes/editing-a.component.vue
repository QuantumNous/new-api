<script setup lang="ts">
import { ref } from 'vue'
import { useBlocker, useNavigate } from '@tanstack/vue-router'

const navigate = useNavigate()
const input = ref('')

const blocker = useBlocker({
  shouldBlockFn: ({ next }) => {
    if (next.fullPath === '/editing-b' && input.value.length > 0) {
      return true
    }
    return false
  },
  withResolver: true,
})
</script>

<template>
  <div>
    <h1>Editing A</h1>
    <label>
      Enter your name:
      <input name="input" v-model="input" />
    </label>
    <button @click="navigate({ to: '/editing-b' })">Go to next step</button>
    <button v-if="blocker.status === 'blocked'" @click="blocker.proceed?.()">
      Proceed
    </button>
  </div>
</template>
