<script setup lang="ts">
import activityDayBanner from '@/assets/activity/activity-banner-day-sketch.webp'
import activityNightBanner from '@/assets/activity/activity-banner.webp'
import { useThemedAsset } from '@/composables/useThemedAsset'

defineProps<{
  title: string
  subtitle: string
  pill: string
}>()

const activityBanner = useThemedAsset(activityDayBanner, activityNightBanner)
</script>

<template>
  <section
    class="activity-hero pencil-surface relative overflow-hidden rounded-2xl shadow-[var(--card-shadow)]"
    data-handdrawn="surface-clipped"
  >
    <!-- generated banner art -->
    <img
      :src="activityBanner"
      alt=""
      aria-hidden="true"
      class="absolute inset-0 h-full w-full object-cover"
    />
    <!-- readability scrim -->
    <div class="activity-hero__scrim absolute inset-0" />

    <!-- content -->
    <div class="relative z-10 px-8 py-8 sm:py-10">
      <span
        class="activity-hero__pill inline-flex items-center rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm"
      >
        {{ pill }}
      </span>
      <h1
        class="activity-hero__title mt-3 text-3xl font-bold tracking-tight text-white drop-shadow sm:text-4xl"
      >
        {{ title }}
      </h1>
      <p
        class="activity-hero__copy mt-2 max-w-xl text-sm leading-relaxed text-white/80"
      >
        {{ subtitle }}
      </p>
    </div>
  </section>
</template>

<style scoped>
.activity-hero__scrim {
  background: linear-gradient(
    105deg,
    rgba(16, 12, 8, 0.82) 0%,
    rgba(16, 12, 8, 0.52) 50%,
    rgba(16, 12, 8, 0.15) 100%
  );
}

:global(html.dark .activity-hero) {
  border-radius: 1rem !important;
  background-color: transparent;
  box-shadow: var(--card-shadow) !important;
}

:global(html.light .activity-hero__scrim) {
  background: linear-gradient(
    105deg,
    rgba(252, 249, 241, 0.96) 0%,
    rgba(252, 249, 241, 0.76) 50%,
    rgba(252, 249, 241, 0.12) 100%
  );
}

:global(html.light .activity-hero__pill) {
  border: 1px solid var(--pencil-line-soft);
  background: rgba(255, 253, 248, 0.78);
  color: var(--accent-text);
  box-shadow: 1px 1px 0 var(--pencil-line-faint);
}

:global(html.light .activity-hero__title) {
  color: var(--text-primary);
  filter: none;
}

:global(html.light .activity-hero__copy) {
  color: var(--text-secondary);
}
</style>
