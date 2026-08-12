<script setup lang="ts">
import { experimental_useObject } from './use-object';
import { z } from 'zod/v4';
import { ref, reactive } from 'vue';

const onFinishCalls: Array<{
  object: { content: string } | undefined;
  error: Error | undefined;
}> = reactive([]);

const onErrorResult: Error | undefined = ref(undefined);

const { object, error, submit, isLoading, stop, clear } =
  experimental_useObject({
    api: '/api/use-object',
    schema: z.object({ content: z.string() }),
    onError(error) {
      onErrorResult.value = error;
    },
    onFinish(event) {
      onFinishCalls.push(event);
    },
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
    <div data-testid="on-error-result">{{ onErrorResult?.toString() }}</div>
    <div data-testid="on-finish-calls">{{ JSON.stringify(onFinishCalls) }}</div>
  </div>
</template>
