<script setup lang="ts">
import type { UIMessage } from 'ai';
import { reactive } from 'vue';
import { Chat } from './chat.vue';

const onFinishCalls: Array<{ message: UIMessage }> = reactive([]);

const chat = new Chat({
  onFinish: options => {
    onFinishCalls.push(options);
  },
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

    <button data-testid="do-append" @click="chat.sendMessage({ text: 'hi' })" />
    <div data-testid="on-finish-calls">{{ JSON.stringify(onFinishCalls) }}</div>
  </div>
</template>
