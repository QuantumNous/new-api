<script setup lang="ts">
import { computed } from 'vue'

import { safeImageUrl } from '@/utils/safeUrl'
/**
 * CSS-columns masonry shared by Studio (generated works) and Community.
 * Each tile shows a cover with a hover overlay carrying a caption and an
 * optional meta line (author · likes, or a type badge). Purely presentational.
 */
export interface GalleryTile {
  id: number
  cover: string
  caption: string
  /** small pill on the cover, top-left (e.g. 视频 / 时长) */
  badge?: string
  /** secondary line in the hover overlay (e.g. author) */
  meta?: string
  /** trailing metric in the hover overlay (e.g. ♥ 1.2k) */
  metric?: string
}

const props = withDefaults(
  defineProps<{
    tiles: GalleryTile[]
    /** loading → render N shimmering placeholder tiles */
    loading?: boolean
    skeletonCount?: number
  }>(),
  { loading: false, skeletonCount: 9 }
)

// Staggered heights so placeholder tiles read as masonry, not a grid.
const SKELETON_HEIGHTS = [220, 300, 180, 260, 200, 320, 240, 190, 280]
const safeTiles = computed(() =>
  props.tiles.flatMap((tile) => {
    const cover = safeImageUrl(tile.cover)
    return cover ? [{ ...tile, cover }] : []
  })
)
</script>

<template>
  <!-- loading skeleton -->
  <div v-if="loading" class="gallery-cols">
    <div
      v-for="i in skeletonCount"
      :key="i"
      class="mb-4 animate-pulse rounded-2xl bg-[var(--surface-muted)]"
      :style="{ height: `${SKELETON_HEIGHTS[i % SKELETON_HEIGHTS.length]}px` }"
    />
  </div>

  <div v-else class="gallery-cols">
    <figure
      v-for="tile in safeTiles"
      :key="tile.id"
      tabindex="0"
      class="pencil-surface group relative mb-4 overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-solid)] shadow-[var(--card-shadow)] transition-shadow hover:shadow-[var(--card-shadow-hover)] focus-ring"
      data-handdrawn="surface-clipped"
    >
      <img
        :src="tile.cover"
        :alt="tile.caption"
        class="block w-full"
        loading="lazy"
      />

      <span
        v-if="tile.badge"
        class="absolute left-2.5 top-2.5 rounded-full bg-[var(--drawer-backdrop)] px-2 py-0.5 text-[11px] font-medium text-[var(--on-colored)] backdrop-blur-sm"
      >
        {{ tile.badge }}
      </span>

      <!-- hover overlay -->
      <figcaption
        class="gallery-caption pointer-events-none absolute inset-x-0 bottom-0 translate-y-2 bg-gradient-to-t from-[var(--drawer-backdrop)] to-transparent p-3 pt-8 opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100"
      >
        <p class="truncate text-sm font-semibold text-[var(--on-colored)]">
          {{ tile.caption }}
        </p>
        <div
          v-if="tile.meta || tile.metric"
          class="mt-0.5 flex items-center justify-between gap-2"
        >
          <span
            class="min-w-0 truncate text-xs text-[var(--on-colored)] opacity-80"
            >{{ tile.meta }}</span
          >
          <span
            v-if="tile.metric"
            class="shrink-0 text-xs text-[var(--on-colored)] opacity-80"
            >{{ tile.metric }}</span
          >
        </div>
      </figcaption>
    </figure>
  </div>
</template>

<style scoped>
.gallery-cols {
  column-count: 2;
  column-gap: 1rem;
}
@media (min-width: 768px) {
  .gallery-cols {
    column-count: 3;
  }
}
@media (min-width: 1280px) {
  .gallery-cols {
    column-count: 4;
  }
}
.gallery-cols > * {
  break-inside: avoid;
}
@media (hover: none), (pointer: coarse) {
  .gallery-caption {
    transform: translateY(0);
    opacity: 1;
  }
}
</style>
