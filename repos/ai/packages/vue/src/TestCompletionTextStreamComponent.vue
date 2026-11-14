<script setup lang="ts">
import { useCompletion } from './use-completion';

const { completion, handleSubmit, input, isLoading, error } = useCompletion({
  streamProtocol: 'text',
});
</script>

<template>
  <div>
    <div data-testid="loading">{{ isLoading?.toString() }}</div>
    <div data-testid="error">{{ error?.toString() }}</div>
    <div data-testid="completion">{{ completion }}</div>

    <form @submit="handleSubmit">
      <input data-testid="input" v-model="input" />
    </form>
  </div>
</template>
