<script setup lang="ts">
import { experimental_useObject } from './use-object';
import { z } from 'zod/v4';
import { ref, reactive } from 'vue';

const { object, error, submit, isLoading, stop, clear } =
  experimental_useObject({
    api: '/api/use-object',
    schema: z.object({ content: z.string() }),
    headers: {
      Authorization: 'Bearer TEST_TOKEN',
      'X-Custom-Header': 'CustomValue',
    },
    credentials: 'include',
  });
</script>

<template>
  <div>
    <div data-testid="loading">{{ isLoading.toString() }}</div>
    <div data-testid="object">{{ JSON.stringify(object) }}</div>
    <div data-testid="error">{{ error?.toString() }}</div>
    <button data-testid="submit-button" @click="submit('test-input')">
      Generate
    </button>
    <button data-testid="stop-button" @click="stop">Stop</button>
    <button data-testid="clear-button" @click="clear">Clear</button>
  </div>
</template>
