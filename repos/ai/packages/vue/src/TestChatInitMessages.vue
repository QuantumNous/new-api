<script setup lang="ts">
import type { UIMessage } from 'ai';
import { Chat } from './chat.vue';
import { ref } from 'vue';

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
  messages: messages.value,
});
</script>

<template>
  <div>
    <div data-testid="status">{{ chat.status }}</div>
    <div data-testid="error">{{ chat.error?.toString() }}</div>
    <div
      v-for="(m, idx) in chat.messages"
      key="m.id"
      :data-testid="`message-${idx}`"
    >
      {{ m.role === 'user' ? 'User: ' : 'AI: ' }}
      {{
        m.parts.map(part => (part.type === 'text' ? part.text : '')).join('')
      }}
    </div>

    <button
      data-testid="do-append"
      @click="chat.sendMessage({ text: 'Hi.' })"
    />
  </div>
</template>
