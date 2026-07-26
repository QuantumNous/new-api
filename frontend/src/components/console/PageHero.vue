<script setup lang="ts">
import Breadcrumb from './Breadcrumb.vue'
import ConsoleTabs, { type TabItem } from '@/components/common/ConsoleTabs.vue'

const tab = defineModel<string>('tab', { default: '' })

withDefaults(
  defineProps<{
    title: string
    titleAccent?: string
    crumbs?: string[]
    tabs?: TabItem[]
  }>(),
  { titleAccent: '', crumbs: () => [], tabs: () => [] }
)
</script>

<template>
  <div class="mb-8">
    <!-- breadcrumb -->
    <Breadcrumb :crumbs="crumbs" />

    <!-- title row -->
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div class="min-w-0">
        <h1 class="display-title text-4xl font-bold text-[var(--text-primary)]">
          {{ title }}
          <span v-if="titleAccent" class="text-[var(--accent-text)]">
            &amp; {{ titleAccent }}</span
          >
        </h1>
        <!-- hero metric slot (wallet balance, etc.) -->
        <slot />
      </div>
      <div class="flex min-w-0 items-center gap-5">
        <!-- right-side actions slot -->
        <slot name="actions" />
        <!-- decorative spot illustration (desktop only) -->
        <div v-if="$slots.art" class="hidden shrink-0 lg:block">
          <slot name="art" />
        </div>
      </div>
    </div>

    <ConsoleTabs v-if="tabs.length" v-model="tab" :items="tabs" class="mt-5" />
  </div>
</template>
