<script setup lang="ts">
import { ref, toValue } from 'vue'
import { useBlocker, useNavigate } from '@tanstack/vue-router'

const navigate = useNavigate()
const input = ref('')

const blocker = useBlocker({
  shouldBlockFn: () => !!toValue(input),
  withResolver: true,
})
</script>

<template>
  <div>
    <h1>Editing B</h1>
    <label>
      Enter your name:
      <input name="input" v-model="input" />
    </label>
    <button @click="navigate({ to: '/editing-a' })">Go back</button>
    <button v-if="blocker.status === 'blocked'" @click="blocker.proceed?.()">
      Proceed
    </button>
  </div>
</template>
