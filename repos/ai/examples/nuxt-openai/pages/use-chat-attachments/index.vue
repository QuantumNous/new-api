<script setup lang="ts">
import { Chat } from '@ai-sdk/vue';
import { computed, ref } from 'vue';

const chat = new Chat({});

const files = ref<FileList | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);
const input = ref('');

const submit = (e: Event) => {
  e.preventDefault();

  chat.sendMessage({
    text: input.value,
    files: files.value ?? undefined,
  });

  files.value = null;
  fileInputRef.value!.value = '';
};

const filesWithUrl = computed(() => {
  if (!files.value) return [];

  return Array.from(files.value).map(file => ({
    file,
    url: URL.createObjectURL(file),
  }));
});
</script>

<template>
  <div class="flex flex-col w-full max-w-md py-24 mx-auto stretch">
    <div
      v-for="message in chat.messages"
      :key="message.id"
      class="whitespace-pre-wrap"
    >
      <strong>{{ `${message.role}: ` }}</strong>
      {{
        message.parts
          .map(part => (part.type === 'text' ? part.text : ''))
          .join('')
      }}

      <div
        v-if="message.parts.some(part => part.type === 'file')"
        class="flex flex-row gap-2"
      >
        <img
          v-for="(attachment, index) in message.parts.filter(
            part => part.type === 'file',
          )"
          :key="`${message.id}-${index}`"
          :src="attachment.url"
          class="rounded-md size-20"
        />
      </div>
    </div>

    <form
      @submit="submit"
      class="fixed bottom-0 flex flex-col max-w-md gap-2 mb-8"
    >
      <div class="flex flex-row gap-2">
        <img
          v-for="file in filesWithUrl"
          :key="file.file.name"
          :src="file.url"
          class="rounded-md size-20"
        />
      </div>
      <input
        ref="fileInputRef"
        type="file"
        accept="image/*"
        multiple
        @change="files = ($event.target as HTMLInputElement).files"
      />
      <input
        class="w-full p-2 border border-gray-300 rounded shadow-xl"
        v-model="input"
        placeholder="Say something..."
      />
    </form>
  </div>
</template>
