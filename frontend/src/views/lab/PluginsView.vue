<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import ConsoleTabs, { type TabItem } from '@/components/common/ConsoleTabs.vue'
import ConsoleToggle from '@/components/common/ConsoleToggle.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import SearchInput from '@/components/common/SearchInput.vue'
import { useFeatureAccess } from '@/composables/useFeatureAccess'
import { useLabPlugins } from '@/composables/useLab'
import { useToast } from '@/composables/useToast'
import type { MarketPlugin, PluginCategory } from '@/types/lab'

const { t } = useI18n()
const toast = useToast()
const { readOnly } = useFeatureAccess('lab', 'prototype')
const { loading, plugins, mcp, skills, market, load } = useLabPlugins()

const tab = ref('plugins')
const pluginsPanelId = 'lab-plugins-tab-panel'
const keyword = ref('')
const marketSubTab = ref<'public' | 'personal'>('public')

const tabItems = computed<TabItem[]>(() => [
  {
    key: 'plugins',
    label:
      `${t('lab.plugins.tabPlugins')} ${plugins.value.length || ''}`.trim(),
  },
  { key: 'mcp', label: `MCP ${mcp.value.length || ''}`.trim() },
  {
    key: 'skills',
    label: `${t('lab.plugins.tabSkills')} ${skills.value.length || ''}`.trim(),
  },
  { key: 'market', label: t('lab.plugins.tabMarket') },
])

const kw = computed(() => keyword.value.trim().toLowerCase())
const filteredPlugins = computed(() =>
  kw.value
    ? plugins.value.filter((p) =>
        `${p.name} ${p.desc}`.toLowerCase().includes(kw.value)
      )
    : plugins.value
)
const filteredMcp = computed(() =>
  kw.value
    ? mcp.value.filter((m) => m.name.toLowerCase().includes(kw.value))
    : mcp.value
)
const filteredSkills = computed(() =>
  kw.value
    ? skills.value.filter((s) =>
        `${s.name} ${s.desc}`.toLowerCase().includes(kw.value)
      )
    : skills.value
)

const categoryLabels = computed<Record<PluginCategory, string>>(() => ({
  featured: t('lab.plugins.categoryFeatured'),
  productivity: t('lab.plugins.categoryProductivity'),
  ai: t('lab.plugins.categoryAi'),
  data: t('lab.plugins.categoryData'),
}))
const marketCategories = computed(() => {
  const filtered = kw.value
    ? market.value.filter((p) =>
        `${p.name} ${p.desc}`.toLowerCase().includes(kw.value)
      )
    : market.value
  const groups: Record<PluginCategory, MarketPlugin[]> = {
    featured: [],
    productivity: [],
    ai: [],
    data: [],
  }
  for (const p of filtered) groups[p.category].push(p)
  return (['featured', 'productivity', 'ai', 'data'] as PluginCategory[])
    .filter((k) => groups[k].length > 0)
    .map((k) => ({ key: k, label: categoryLabels.value[k], items: groups[k] }))
})

onMounted(() => void load())
function stub() {
  if (readOnly.value) return
  toast.info(t('lab.prototypeToast'))
}
</script>

<template>
  <div
    class="subtle-scroll h-full overflow-y-auto"
    data-handdrawn-page="plugins"
  >
    <div class="mx-auto max-w-[900px] px-4 py-8 sm:px-6">
      <!-- page header -->
      <div class="mb-6">
        <h1
          class="gesture-mark text-2xl font-bold tracking-tight text-[var(--text-primary)]"
        >
          {{ t('lab.plugins.title') }}
        </h1>
        <p class="mt-1 text-sm text-[var(--text-tertiary)]">
          {{ t('lab.plugins.subtitle') }}
        </p>
      </div>

      <!-- tabs + search -->
      <div class="mb-6 flex flex-wrap items-end justify-between gap-3">
        <ConsoleTabs
          v-model="tab"
          :items="tabItems"
          :panel-id="pluginsPanelId"
        />
        <SearchInput
          v-model="keyword"
          :placeholder="t('lab.plugins.search')"
          class="w-52"
        />
      </div>

      <div
        :id="pluginsPanelId"
        role="tabpanel"
        :aria-labelledby="`${pluginsPanelId}-tab-${tab}`"
      >
        <!-- ===== plugins tab ===== -->
        <template v-if="tab === 'plugins'">
          <!-- skeleton -->
          <div v-if="loading">
            <div class="mb-5 flex gap-2">
              <div
                v-for="i in 8"
                :key="i"
                class="h-10 w-10 shrink-0 animate-pulse rounded-xl bg-[var(--surface-muted)]"
              />
            </div>
            <div class="space-y-0">
              <div
                v-for="i in 6"
                :key="i"
                class="flex items-center gap-3 border-b border-[var(--border-subtle)] py-3 last:border-0"
              >
                <div
                  class="h-10 w-10 shrink-0 animate-pulse rounded-xl bg-[var(--surface-muted)]"
                />
                <div class="flex-1 space-y-1.5">
                  <div
                    class="h-3.5 w-32 animate-pulse rounded bg-[var(--surface-muted)]"
                  />
                  <div
                    class="h-3 w-56 animate-pulse rounded bg-[var(--surface-muted)]"
                  />
                </div>
                <div
                  class="h-6 w-11 animate-pulse rounded-full bg-[var(--surface-muted)]"
                />
              </div>
            </div>
          </div>

          <template v-else>
            <!-- installed icon strip -->
            <div class="mb-3 flex items-center justify-between">
              <span class="text-sm font-semibold text-[var(--text-primary)]">
                {{ t('lab.plugins.installed', { count: plugins.length }) }}
              </span>
              <button
                type="button"
                class="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-tertiary)] hover:bg-[var(--surface-muted)] focus-ring"
                :title="t('lab.plugins.manage')"
                :aria-label="t('lab.plugins.manage')"
                :disabled="readOnly"
                @click="stub"
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
                  />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </button>
            </div>
            <!-- icon strip -->
            <div class="mb-5 flex gap-2 overflow-x-auto pb-1">
              <button
                v-for="p in plugins"
                :key="p.id"
                type="button"
                class="pencil-brand-frame flex h-10 w-10 shrink-0 items-center justify-center rounded-xl opacity-90 transition-opacity hover:opacity-100 focus-ring"
                :style="{ background: p.color }"
                :title="p.name"
                :aria-label="p.name"
                :disabled="readOnly"
                @click="stub"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  stroke-width="1.8"
                >
                  <path :d="p.icon" />
                </svg>
              </button>
            </div>

            <!-- plugin list -->
            <ul
              class="divide-y divide-[var(--border-subtle)]"
              data-handdrawn="ledger-list"
            >
              <li
                v-for="p in filteredPlugins"
                :key="p.id"
                class="flex items-center gap-3 py-3"
              >
                <button
                  type="button"
                  class="pencil-brand-frame flex h-10 w-10 shrink-0 items-center justify-center rounded-xl focus-ring"
                  :style="{ background: p.color }"
                  :aria-label="p.name"
                  :disabled="readOnly"
                  @click="stub"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    stroke-width="1.8"
                  >
                    <path :d="p.icon" />
                  </svg>
                </button>
                <div class="min-w-0 flex-1">
                  <p
                    class="truncate text-sm font-semibold text-[var(--text-primary)]"
                  >
                    {{ p.name }}
                  </p>
                  <p class="truncate text-xs text-[var(--text-tertiary)]">
                    {{ p.desc }}
                  </p>
                </div>
                <ConsoleToggle
                  v-model="p.enabled"
                  :label="p.name"
                  :disabled="readOnly"
                />
              </li>
            </ul>
            <EmptyState
              v-if="filteredPlugins.length === 0"
              :title="t('lab.plugins.noResult')"
            />
          </template>
        </template>

        <!-- ===== MCP tab ===== -->
        <template v-else-if="tab === 'mcp'">
          <div class="mb-4 flex items-center justify-between gap-2">
            <span class="text-sm font-semibold text-[var(--text-primary)]">{{
              t('lab.plugins.mcpServers')
            }}</span>
            <button
              type="button"
              class="pencil-control flex h-9 items-center gap-2 rounded-xl bg-[var(--accent)] px-3 text-xs font-semibold text-[var(--accent-contrast)] hover:bg-[var(--accent-hover)] focus-ring"
              data-handdrawn="control"
              :disabled="readOnly"
              @click="stub"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.2"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              {{ t('lab.plugins.mcpAdd') }}
            </button>
          </div>
          <div v-if="loading" class="space-y-0">
            <div
              v-for="i in 2"
              :key="i"
              class="flex items-center gap-3 border-b border-[var(--border-subtle)] py-3 last:border-0"
            >
              <div
                class="h-10 w-10 shrink-0 animate-pulse rounded-xl bg-[var(--surface-muted)]"
              />
              <div class="flex-1 space-y-1.5">
                <div
                  class="h-3.5 w-36 animate-pulse rounded bg-[var(--surface-muted)]"
                />
                <div
                  class="h-3 w-52 animate-pulse rounded bg-[var(--surface-muted)]"
                />
              </div>
            </div>
          </div>
          <ul
            v-else-if="filteredMcp.length"
            class="divide-y divide-[var(--border-subtle)]"
            data-handdrawn="ledger-list"
          >
            <li
              v-for="m in filteredMcp"
              :key="m.id"
              class="flex items-center gap-3 py-3"
            >
              <span
                class="pencil-brand-frame flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--signal-soft)]"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--signal)"
                  stroke-width="1.8"
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </span>
              <div class="min-w-0 flex-1">
                <p
                  class="flex items-center gap-2 truncate text-sm font-semibold text-[var(--text-primary)]"
                >
                  {{ m.name }}
                  <span
                    class="inline-flex items-center gap-1 text-[11px] font-medium"
                    :style="{
                      color: m.connected
                        ? 'var(--status-success)'
                        : 'var(--text-tertiary)',
                    }"
                  >
                    <span
                      class="h-1.5 w-1.5 rounded-full"
                      :style="{
                        background: m.connected
                          ? 'var(--status-success)'
                          : 'var(--border-default)',
                      }"
                    />
                    {{
                      m.connected
                        ? t('lab.plugins.connected')
                        : t('lab.plugins.disconnected')
                    }}
                  </span>
                </p>
                <p class="truncate text-xs text-[var(--text-tertiary)]">
                  {{ m.desc }}
                </p>
              </div>
              <ConsoleToggle
                v-model="m.enabled"
                :label="m.name"
                :disabled="readOnly"
              />
            </li>
          </ul>
          <EmptyState
            v-else
            :title="t('lab.plugins.mcpEmpty')"
            :hint="t('lab.plugins.mcpEmptyHint')"
          >
            <button
              type="button"
              class="mt-4 flex h-9 items-center gap-2 rounded-xl border border-[var(--border-default)] px-4 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--surface-muted)] focus-ring"
              :disabled="readOnly"
              @click="stub"
            >
              {{ t('lab.plugins.mcpAdd') }}
            </button>
          </EmptyState>
        </template>
        <!-- ===== skills tab ===== -->
        <template v-else-if="tab === 'skills'">
          <div class="mb-5 flex items-center justify-between">
            <span class="text-sm font-semibold text-[var(--text-primary)]">
              {{ t('lab.plugins.tabSkills') }} ({{ skills.length }})
            </span>
            <button
              type="button"
              class="pencil-control flex h-9 items-center gap-2 rounded-xl bg-[var(--accent)] px-3 text-xs font-semibold text-[var(--accent-contrast)] hover:bg-[var(--accent-hover)] focus-ring"
              data-handdrawn="control"
              :disabled="readOnly"
              @click="stub"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.2"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              {{ t('lab.plugins.skillCreate') }}
            </button>
          </div>
          <div v-if="loading" class="grid gap-4 sm:grid-cols-2">
            <div
              v-for="i in 4"
              :key="i"
              class="h-28 animate-pulse rounded-2xl bg-[var(--surface-muted)]"
            />
          </div>
          <div v-else class="grid gap-4 sm:grid-cols-2">
            <article
              v-for="s in filteredSkills"
              :key="s.id"
              class="pencil-surface flex cursor-pointer flex-col rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-solid)] p-4 shadow-[var(--card-shadow)] transition-shadow hover:shadow-[var(--card-shadow-hover)]"
              data-handdrawn="surface"
              role="button"
              :tabindex="readOnly ? -1 : 0"
              :aria-disabled="readOnly"
              @click="stub"
              @keydown.enter="stub"
              @keydown.space.prevent="stub"
            >
              <div class="mb-2 flex items-start justify-between gap-3">
                <span
                  class="pencil-brand-frame flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                  :style="{ background: s.color }"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    stroke-width="1.8"
                  >
                    <path :d="s.icon" />
                  </svg>
                </span>
                <svg
                  v-if="s.active"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--status-success)"
                  stroke-width="2.5"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </div>
              <p class="mb-1 text-sm font-semibold text-[var(--text-primary)]">
                {{ s.name }}
              </p>
              <p class="text-xs leading-relaxed text-[var(--text-tertiary)]">
                {{ s.desc }}
              </p>
            </article>
          </div>
          <EmptyState
            v-if="!loading && filteredSkills.length === 0"
            :title="t('lab.plugins.noResult')"
          />
        </template>

        <!-- ===== market tab ===== -->
        <template v-else>
          <div class="mb-5 flex items-center justify-between gap-3">
            <div class="flex gap-2">
              <button
                v-for="st in ['public', 'personal'] as const"
                :key="st"
                type="button"
                class="h-8 rounded-full px-3.5 text-xs font-medium transition-colors focus-ring"
                :style="
                  marketSubTab === st
                    ? 'background:var(--accent);color:var(--accent-contrast)'
                    : 'color:var(--text-secondary)'
                "
                :class="
                  marketSubTab === st
                    ? ''
                    : 'bg-[var(--surface-muted)] hover:bg-[var(--surface-hover)]'
                "
                @click="marketSubTab = st"
              >
                {{
                  t(
                    st === 'public'
                      ? 'lab.plugins.marketPublic'
                      : 'lab.plugins.marketPersonal'
                  )
                }}
              </button>
            </div>
            <button
              type="button"
              class="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-tertiary)] hover:bg-[var(--surface-muted)] focus-ring"
              :aria-label="t('lab.plugins.filter')"
              :disabled="readOnly"
              @click="stub"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M3 6h18M7 12h10M11 18h2" />
              </svg>
            </button>
          </div>
          <div v-if="loading" class="space-y-8">
            <div v-for="i in 2" :key="i">
              <div
                class="mb-3 h-4 w-24 animate-pulse rounded bg-[var(--surface-muted)]"
              />
              <div class="grid gap-3 sm:grid-cols-2">
                <div
                  v-for="j in 4"
                  :key="j"
                  class="h-16 animate-pulse rounded-2xl bg-[var(--surface-muted)]"
                />
              </div>
            </div>
          </div>
          <div v-else class="space-y-8">
            <section v-for="group in marketCategories" :key="group.key">
              <h3 class="mb-3 text-sm font-semibold text-[var(--text-primary)]">
                {{ group.label }}
              </h3>
              <div class="grid gap-3 sm:grid-cols-2">
                <article
                  v-for="p in group.items"
                  :key="p.id"
                  class="pencil-surface relative flex items-center gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-solid)] px-4 py-3 shadow-[var(--card-shadow)] transition-shadow hover:shadow-[var(--card-shadow-hover)]"
                  data-handdrawn="surface"
                >
                  <button
                    type="button"
                    class="absolute inset-0 cursor-pointer rounded-2xl focus-ring"
                    :aria-label="p.name"
                    :disabled="readOnly"
                    @click="stub"
                  />
                  <span
                    class="pencil-brand-frame pointer-events-none flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    :style="{ background: p.color }"
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      stroke-width="1.8"
                    >
                      <path :d="p.icon" />
                    </svg>
                  </span>
                  <div class="pointer-events-none min-w-0 flex-1">
                    <p
                      class="truncate text-sm font-semibold text-[var(--text-primary)]"
                    >
                      {{ p.name }}
                    </p>
                    <p class="truncate text-xs text-[var(--text-tertiary)]">
                      {{ p.desc }}
                    </p>
                  </div>
                  <button
                    type="button"
                    class="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--text-tertiary)] hover:bg-[var(--surface-muted)] focus-ring"
                    :aria-label="t('lab.plugins.moreActions', { name: p.name })"
                    :disabled="readOnly"
                    @click="stub"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <circle cx="12" cy="5" r="1" />
                      <circle cx="12" cy="12" r="1" />
                      <circle cx="12" cy="19" r="1" />
                    </svg>
                  </button>
                </article>
              </div>
            </section>
            <EmptyState
              v-if="marketCategories.length === 0"
              :title="t('lab.plugins.noResult')"
            />
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
