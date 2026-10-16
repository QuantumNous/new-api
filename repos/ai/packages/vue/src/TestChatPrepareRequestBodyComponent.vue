<script setup lang="ts">
import { DefaultChatTransport } from 'ai';
import { computed, ref } from 'vue';
import { Chat } from './chat.vue';

const options = ref<any>();

const chat = new Chat({
  transport: new DefaultChatTransport({
    api: '/api/chat',
    prepareSendMessagesRequest(optionsArg) {
      options.value = JSON.parse(JSON.stringify(optionsArg));
      return {
        body: { 'body-key': 'body-value' },
        headers: { 'header-key': 'header-value' },
      };
    },
  }),
});

const isLoading = computed(() => chat.status !== 'ready');
</script>

<template>
  <div>
    <div data-testid="loading">{{ isLoading?.toString() }}</div>
    <div
      v-for="(m, idx) in chat.messages"
      :key="m.id"
      :data-testid="`message-${idx}`"
    >
      {{ m.role === 'user' ? 'User: ' : 'AI: ' }}
      {{
        m.parts.map(part => (part.type === 'text' ? part.text : '')).join('')
      }}
    </div>

    <button
      data-testid="do-append"
      @click="
        chat.sendMessage(
          {
            role: 'user',
            parts: [{ text: 'hi', type: 'text' }],
          },
          {
            body: { 'request-body-key': 'request-body-value' },
            headers: { 'request-header-key': 'request-header-value' },
            metadata: { 'request-metadata-key': 'request-metadata-value' },
          },
        )
      "
    />

    <div v-if="options" data-testid="on-options">
      {{ options }}
    </div>
  </div>
</template>
