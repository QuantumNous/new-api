<script setup lang="ts">
import { experimental_useObject as useObject } from '@ai-sdk/vue';
import { notificationSchema } from '~/shared/notification-schema';

const { submit, isLoading, object, stop, error, clear } = useObject({
  api: '/api/use-object',
  schema: notificationSchema,
});
</script>

<template>
  <div class="flex flex-col items-center min-h-screen p-4 m-4">
    <button
      class="px-4 py-2 mt-4 text-white bg-blue-500 rounded-md disabled:bg-blue-200"
      @click="() => submit('Messages during finals week.')"
      :disabled="isLoading"
    >
      Generate notifications
    </button>

    <div v-if="error" class="mt-4 text-red-500">
      An error occurred. {{ error.message }}
    </div>

    <div v-if="isLoading" class="mt-4 text-gray-500">
      <div>Loading...</div>
      <button
        type="button"
        class="px-4 py-2 mt-4 text-blue-500 border border-blue-500 rounded-md"
        @click="stop"
      >
        STOP
      </button>
    </div>

    <div class="mt-4 text-gray-500">
      <button
        type="button"
        @click="clear"
        class="px-4 py-2 mt-4 text-blue-500 border border-blue-500 rounded-md"
      >
        Clear
      </button>
    </div>

    <div class="flex flex-col gap-4 mt-4">
      <div
        v-for="(notification, index) in object?.notifications || []"
        :key="index"
        class="flex items-start gap-4 p-4 bg-gray-100 rounded-md dark:bg-gray-800"
      >
        <div class="flex-1 space-y-1">
          <div class="flex items-center justify-between">
            <p class="font-medium dark:text-white">
              {{ notification?.name }}
            </p>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              {{ notification?.minutesAgo }}
              <template v-if="notification?.minutesAgo != null">
                minutes ago</template
              >
            </p>
          </div>
          <p class="text-gray-700 dark:text-gray-300">
            {{ notification?.message }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
