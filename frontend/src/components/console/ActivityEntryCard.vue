<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  title: string
  subtitle: string
  tag: string
  image: string
  /** CSS gradient shown before image loads or on image error */
  gradient: string
  emoji: string
  cta: string
}>()

const emit = defineEmits<{ enter: [] }>()

const imageOk = ref(true)
</script>

<template>
  <button
    type="button"
    class="activity-entry pencil-surface group relative flex h-44 w-full overflow-hidden rounded-2xl border border-[var(--border-subtle)] text-left shadow-[var(--card-shadow)] transition-all hover:shadow-[var(--card-shadow-hover)] focus-ring"
    data-handdrawn="surface-clipped"
    @click="emit('enter')"
  >
    <!-- background gradient (always present as base layer) -->
    <div class="absolute inset-0" :style="{ background: gradient }" />

    <!-- generated banner art -->
    <img
      v-if="imageOk"
      :src="image"
      :alt="title"
      class="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
      @error="imageOk = false"
    />

    <!-- readability scrim -->
    <div class="activity-entry__scrim absolute inset-0" />

    <!-- content -->
    <div class="relative z-10 flex flex-col justify-between p-5">
      <div>
        <span
          class="activity-entry__tag inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm"
        >
          {{ emoji }} {{ tag }}
        </span>
        <h3
          class="activity-entry__title mt-2.5 text-xl font-bold tracking-tight text-white drop-shadow"
        >
          {{ title }}
        </h3>
        <p
          class="activity-entry__copy mt-1 max-w-xs text-sm leading-relaxed text-white/80"
        >
          {{ subtitle }}
        </p>
      </div>

      <span
        class="activity-entry__cta mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-white"
      >
        {{ cta }}
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          class="transition-transform group-hover:translate-x-1"
        >
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </span>
    </div>
  </button>
</template>

<style scoped>
.activity-entry__scrim {
  background: linear-gradient(
    90deg,
    var(--media-copy-scrim-strong) 0%,
    var(--media-copy-scrim-medium) 55%,
    var(--media-copy-scrim-soft) 100%
  );
}

.activity-entry__tag {
  background: var(--media-copy-chip);
}

:global(html.dark .activity-entry) {
  border-color: var(--border-subtle) !important;
  border-radius: 1rem !important;
  background-color: transparent;
  box-shadow: var(--card-shadow) !important;
}

:global(html.dark .activity-entry:hover),
:global(html.dark .activity-entry:focus-within) {
  box-shadow: var(--card-shadow-hover) !important;
}

:global(html.light .activity-entry__tag) {
  border: 1px solid var(--pencil-line-soft);
  color: var(--accent-text);
  box-shadow: 1px 1px 0 var(--pencil-line-faint);
}

:global(html.light .activity-entry__title),
:global(html.light .activity-entry__cta) {
  color: var(--text-primary);
  filter: none;
}

:global(html.light .activity-entry__copy) {
  color: var(--text-secondary);
}
</style>
