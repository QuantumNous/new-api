<script setup lang="ts">
import { Chat } from '@ai-sdk/vue';
import { createIdGenerator, type UIMessage } from 'ai';
import { computed, ref } from 'vue';

const messages = ref<UIMessage[]>([
  {
    id: 'message-0',
    role: 'user',
    parts: [{ type: 'text', text: 'Greetings.' }],
  },
  {
    id: 'message-1',
    role: 'assistant',
    parts: [{ type: 'text', text: 'Hello.' }],
  },
]);

const chat = new Chat({
  generateId: createIdGenerator({ prefix: 'msgc', size: 16 }),
  messages: messages.value,
});

const messageList = computed(() => chat.messages); // computed property for type inference
const input = ref('');

const handleSubmit = (e: Event) => {
  e.preventDefault();
  chat.sendMessage({ text: input.value });
  input.value = '';
};
</script>

<template>
  <div class="flex flex-col w-full max-w-md py-24 mx-auto stretch">
    <div
      v-for="message in messageList"
      :key="message.id"
      class="whitespace-pre-wrap"
    >
      <strong>{{ `${message.role}: ` }}</strong>
      {{
        message.parts
          .map(part => (part.type === 'text' ? part.text : ''))
          .join('')
      }}
    </div>

    <form @submit="handleSubmit">
      <input
        class="fixed bottom-0 w-full max-w-md p-2 mb-8 border border-gray-300 rounded shadow-xl"
        v-model="input"
        placeholder="Say something..."
      />
    </form>
  </div>
</template>
