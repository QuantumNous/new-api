<script setup lang="ts">
import { Chat } from '@ai-sdk/vue';
import { DefaultChatTransport } from 'ai';
import { computed, ref } from 'vue';

const chat = new Chat({
  // run client-side tools that are automatically executed:
  async onToolCall({ toolCall }) {
    // artificial 2 second delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    if (toolCall.toolName === 'getLocation') {
      const cities = ['New York', 'Los Angeles', 'Chicago', 'San Francisco'];
      const location = cities[Math.floor(Math.random() * cities.length)];

      await chat.addToolOutput({
        toolCallId: toolCall.toolCallId,
        tool: 'getLocation',
        output: location,
      });
    }
  },
  transport: new DefaultChatTransport({
    api: '/api/use-chat-tools',
  }),
});

const messageList = computed(() => chat.messages); // computer property for type inference
const input = ref('');

const handleSubmit = (e: Event) => {
  e.preventDefault();
  chat.sendMessage({ text: input.value });
  input.value = '';
};
</script>

<template>
  <div class="flex flex-col py-24 mx-auto w-full max-w-md stretch">
    <div
      v-for="message in messageList"
      :key="message.id"
      class="whitespace-pre-wrap"
    >
      <strong>{{ `${message.role}: ` }}</strong>
      <template v-for="part in message.parts">
        <template v-if="part.type === 'text'">
          {{ part.text }}
        </template>
        <template v-else-if="part.type === 'tool-askForConfirmation'">
          <template v-if="part.state === 'input-available'">
            <div :key="part.toolCallId" className="text-gray-500">
              {{ (part.input as { message: string }).message }}
              <div className="flex gap-2">
                <button
                  class="px-4 py-2 font-bold text-white bg-blue-500 rounded hover:bg-blue-700"
                  @click="
                    chat.addToolOutput({
                      toolCallId: part.toolCallId,
                      tool: 'askForConfirmation',
                      output: 'Yes, confirmed.',
                    })
                  "
                >
                  Yes
                </button>
                <button
                  class="px-4 py-2 font-bold text-white bg-red-500 rounded hover:bg-red-700"
                  @click="
                    chat.addToolOutput({
                      toolCallId: part.toolCallId,
                      tool: 'askForConfirmation',
                      output: 'No, denied',
                    })
                  "
                >
                  No
                </button>
              </div>
            </div>
          </template>
          <template v-if="part.state === 'output-available'">
            <div :key="part.toolCallId" className="text-gray-500">
              Location access allowed: {{ part.output }}
            </div>
          </template>
        </template>
        <template v-else-if="part.type === 'tool-getLocation'">
          <template v-if="part.state === 'input-available'">
            <div :key="part.toolCallId" className="text-gray-500">
              Getting location...
            </div>
          </template>
          <template v-if="part.state === 'output-available'">
            <div :key="part.toolCallId" className="text-gray-500">
              Location: {{ part.output }}
            </div>
          </template>
        </template>
        <template v-else-if="part.type === 'tool-getWeatherInformation'">
          <template v-if="part.state === 'input-streaming'">
            <pre :key="part.toolCallId">
              {{ JSON.stringify(part, null, 2) }}
            </pre>
          </template>
          <template v-if="part.state === 'input-available'">
            <div :key="part.toolCallId" className="text-gray-500">
              Getting weather information for
              {{ (part.input as { city: string }).city }}...
            </div>
          </template>
          <template v-if="part.state === 'output-available'">
            <div :key="part.toolCallId" className="text-gray-500">
              Weather in {{ (part.input as { city: string }).city }}:
              {{ part.output }}
            </div>
          </template>
        </template>
        <br />
      </template>
    </div>

    <form @submit="handleSubmit">
      <input
        class="fixed bottom-0 p-2 mb-8 w-full max-w-md rounded border border-gray-300 shadow-xl"
        v-model="input"
        placeholder="Say something..."
      />
    </form>
  </div>
</template>
