<script setup lang="ts">
import { generateId } from 'ai';
import { mockId } from 'ai/test';
import { Chat } from './chat.vue';

const chat = new Chat({
  id: generateId(),
  generateId: mockId(),
});
</script>

<template>
  <div>
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

    <button
      data-testid="do-regenerate"
      @click="
        chat.regenerate({
          body: { 'request-body-key': 'request-body-value' },
          headers: { 'header-key': 'header-value' },
        })
      "
    />
  </div>
</template>
