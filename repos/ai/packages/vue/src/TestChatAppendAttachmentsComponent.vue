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
    <div data-testid="messages">
      {{ JSON.stringify(chat.messages, null, 2) }}
    </div>

    <button
      data-testid="do-append"
      @click="
        chat.sendMessage({
          parts: [
            {
              type: 'file',
              url: 'https://example.com/image.png',
              mediaType: 'image/png',
            },
            {
              type: 'text',
              text: 'Message with image attachment',
            },
          ],
        })
      "
    />
  </div>
</template>
