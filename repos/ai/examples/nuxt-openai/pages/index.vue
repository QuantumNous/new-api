<script setup lang="ts">
import { Chat } from '@ai-sdk/vue';
import { computed, ref } from 'vue';

const chat = new Chat({});
const input = ref('');

const disabled = computed(() => chat.status !== 'ready');

const handleSubmit = (e: Event) => {
  e.preventDefault();
  chat.sendMessage({ text: input.value });
  input.value = '';
};
</script>

<template>
  <div class="flex flex-col w-full max-w-md py-24 mx-auto stretch">
    <div v-for="m in chat.messages" :key="m.id" class="whitespace-pre-wrap">
      {{ m.role === 'user' ? 'User: ' : 'AI: ' }}
      {{
        m.parts.map(part => (part.type === 'text' ? part.text : '')).join('')
      }}
    </div>

    <div
      v-if="chat.status === 'submitted' || chat.status === 'streaming'"
      class="mt-4 text-gray-500"
    >
      <div v-if="chat.status === 'submitted'">Loading...</div>
      <button
        type="button"
        class="px-4 py-2 mt-4 text-blue-500 border border-blue-500 rounded-md"
        @click="chat.stop"
      >
        Stop
      </button>
    </div>

    <div v-if="chat.error" class="mt-4">
      <div class="text-red-500">An error occurred.</div>
      <button
        type="button"
        class="px-4 py-2 mt-4 text-blue-500 border border-blue-500 rounded-md"
        @click="() => chat.regenerate()"
      >
        Retry
      </button>
    </div>

    <form @submit="handleSubmit">
      <input
        class="fixed bottom-0 w-full max-w-md p-2 mb-8 border border-gray-300 rounded shadow-xl"
        v-model="input"
        placeholder="Say something..."
        :disabled="disabled"
      />
    </form>
  </div>
</template>
