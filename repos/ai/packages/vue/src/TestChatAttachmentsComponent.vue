<script setup lang="ts">
import { generateId } from 'ai';
import { mockId } from 'ai/test';
import { computed, ref } from 'vue';
import { Chat } from './chat.vue';

const chat = new Chat({
  id: generateId(),
  generateId: mockId(),
});
const files = ref<FileList>();
const fileInputRef = ref<HTMLInputElement | null>(null);
const isLoading = computed(() => chat.status !== 'ready');
const input = ref('');
</script>

<template>
  <div>
    <div data-testid="messages">
      {{ JSON.stringify(chat.messages, null, 2) }}
    </div>

    <form
      @submit="
        event => {
          chat.sendMessage({ text: input, files });
          files = undefined;
          if (fileInputRef) {
            fileInputRef.value = '';
          }
        }
      "
      data-testid="chat-form"
    >
      <input
        type="file"
        @change="
          event => {
            if (event.target != null && 'files' in event.target) {
              files = event.target.files as FileList;
            }
          }
        "
        multiple
        ref="fileInputRef"
        data-testid="file-input"
      />
      <input
        v-model="input"
        :disabled="isLoading"
        data-testid="message-input"
      />
      <button type="submit" data-testid="submit-button">Send</button>
    </form>
  </div>
</template>
