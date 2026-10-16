<script setup lang="ts">
import { ref, computed } from 'vue'

const props = withDefaults(
  defineProps<{
    /**
     * Accepts any valid CSS color value as a string.
     * Note: TypeScript cannot strictly check for all valid CSS colors at type level.
     * For runtime validation, you could use a library or custom validator if desired.
     */
    textColor?: string
  }>(),
  {
    textColor: 'gray',
  },
)

const count = ref(0)

const countLabel = computed(() => {
  if (count.value === 0) return 'Click the logo!'
  if (count.value === 1) return '1 click'
  return `${count.value} clicks`
})

function increment() {
  count.value++
}

function reset() {
  count.value = 0
}
</script>

<template>
  <div class="vue-logo-container">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 261.76 226.69"
      class="vue-logo"
      @click="increment"
    >
      <path
        d="M161.096.001l-30.224 52.35L100.647.002H-.005L130.872 226.69 261.749 0z"
        fill="#41b883"
      />
      <path
        d="M161.096.001l-30.224 52.35L100.647.002H52.346l78.526 136.01L209.398.001z"
        fill="#34495e"
      />
    </svg>
    <p class="count-label" :style="{ color: props.textColor }">
      {{ countLabel }}
    </p>
    <button v-if="count > 0" class="reset-btn" @click="reset">Reset</button>
  </div>
</template>

<style scoped>
.vue-logo-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  margin: 1rem 0;
}

.vue-logo {
  width: 64px;
  height: 64px;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.vue-logo:hover {
  transform: scale(1.1);
}

.vue-logo:active {
  transform: scale(0.95);
}

.count-label {
  margin: 0;
  font-size: 0.875rem;
  color: #666;
}

.reset-btn {
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  background: #41b883;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.reset-btn:hover {
  background: #34495e;
}
</style>
