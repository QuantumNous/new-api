<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import ConsoleButton from '@/components/common/ConsoleButton.vue'
import { api } from '@/api/console'
import { useToast } from '@/composables/useToast'

interface ChannelAffinityStats {
  enabled: boolean
  total: number
  unknown: number
  cache_capacity: number
  cache_algo: string
}

interface PerformanceStats {
  cache_stats: { hit_count: number; miss_count: number }
  memory_stats: { alloc: number; num_goroutine: number }
  disk_cache_info: { total_size: number }
}

interface LogFiles {
  enabled: boolean
  file_count: number
  total_size: number
}

const props = defineProps<{
  kind: 'channel-affinity' | 'performance'
}>()

type Action =
  'clear-affinity' | 'clear-cache' | 'reset-stats' | 'gc' | 'cleanup-logs'

const toast = useToast()
const pendingAction = ref<Action | null>(null)
const loading = ref(false)
const loadingStats = ref(false)
const affinityStats = ref<ChannelAffinityStats | null>(null)
const performanceStats = ref<PerformanceStats | null>(null)
const logFiles = ref<LogFiles | null>(null)
const logCleanupMode = ref<'by_count' | 'by_days'>('by_count')
const logCleanupValue = ref(30)

const actionText = computed(() => {
  switch (pendingAction.value) {
    case 'clear-affinity':
      return {
        title: '清空渠道亲和性缓存',
        message: '现有用户的渠道绑定将被移除。',
      }
    case 'clear-cache':
      return { title: '清理磁盘缓存', message: '将删除不活跃的磁盘缓存文件。' }
    case 'reset-stats':
      return {
        title: '重置缓存统计',
        message: '将重置磁盘缓存的命中与未命中统计。',
      }
    case 'gc':
      return {
        title: '执行垃圾回收',
        message: '将立即执行 Go 运行时垃圾回收。',
      }
    case 'cleanup-logs':
      return {
        title: '清理日志文件',
        message:
          logCleanupMode.value === 'by_count'
            ? `将只保留最新 ${logCleanupValue.value} 个日志文件。`
            : `将删除 ${logCleanupValue.value} 天前的日志文件。`,
      }
    default:
      return { title: '', message: '' }
  }
})

const cacheHitRate = computed(() => {
  const stats = performanceStats.value?.cache_stats
  if (!stats) return '—'
  const total = stats.hit_count + stats.miss_count
  return total === 0 ? '—' : `${Math.round((stats.hit_count / total) * 100)}%`
})

function formatBytes(bytes: number | undefined) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  )
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

async function loadStats() {
  loadingStats.value = true
  try {
    if (props.kind === 'channel-affinity') {
      affinityStats.value = await api.get<ChannelAffinityStats>(
        '/api/option/channel_affinity_cache'
      )
    } else {
      const [stats, logs] = await Promise.all([
        api.get<PerformanceStats>('/api/performance/stats'),
        api.get<LogFiles>('/api/performance/logs'),
      ])
      performanceStats.value = stats
      logFiles.value = logs
    }
  } catch (error) {
    toast.error(error instanceof Error ? error.message : String(error))
  } finally {
    loadingStats.value = false
  }
}

async function runAction() {
  if (!pendingAction.value) return
  loading.value = true
  try {
    switch (pendingAction.value) {
      case 'clear-affinity':
        await api.delete('/api/option/channel_affinity_cache', { all: true })
        break
      case 'clear-cache':
        await api.delete('/api/performance/disk_cache')
        break
      case 'reset-stats':
        await api.post('/api/performance/reset_stats')
        break
      case 'gc':
        await api.post('/api/performance/gc')
        break
      case 'cleanup-logs':
        await api.delete('/api/performance/logs', {
          mode: logCleanupMode.value,
          value: logCleanupValue.value,
        })
        break
    }
    toast.success('操作已完成')
    pendingAction.value = null
    await loadStats()
  } catch (error) {
    toast.error(error instanceof Error ? error.message : String(error))
  } finally {
    loading.value = false
  }
}

onMounted(loadStats)
</script>

<template>
  <section
    class="settings-maintenance-actions mt-6 border-t border-dashed border-[var(--border-default)] pt-5 text-sm text-[var(--text-secondary)]"
  >
    <div class="flex items-center justify-between gap-4">
      <div>
        <h3 class="display-title text-sm font-bold text-[var(--text-primary)]">
          运行状态与维护
        </h3>
        <p
          v-if="loadingStats"
          class="mt-0.5 text-xs text-[var(--text-tertiary)]"
        >
          正在获取最新运行状态…
        </p>
        <p
          v-else-if="kind === 'channel-affinity'"
          class="mt-0.5 text-xs text-[var(--text-tertiary)]"
        >
          缓存 {{ affinityStats?.total ?? 0 }} 条，容量
          {{ affinityStats?.cache_capacity ?? 0 }}。
        </p>
        <p v-else class="mt-0.5 text-xs text-[var(--text-tertiary)]">
          缓存命中率 {{ cacheHitRate }}，日志文件
          {{ logFiles?.file_count ?? 0 }} 个。
        </p>
      </div>
      <ConsoleButton
        variant="ghost"
        size="sm"
        :loading="loadingStats"
        @click="loadStats"
      >
        刷新
      </ConsoleButton>
    </div>

    <!-- KPI Metric Cards Grid -->
    <div
      v-if="kind === 'channel-affinity' && affinityStats"
      class="my-4 grid grid-cols-2 gap-3 sm:grid-cols-3"
    >
      <div
        class="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-table-header)]/60 p-3.5"
      >
        <div class="text-xs font-medium text-[var(--text-tertiary)]">
          缓存条目
        </div>
        <div
          class="mt-1 font-mono text-xl font-bold text-[var(--text-primary)]"
        >
          {{ affinityStats.total }}
        </div>
      </div>
      <div
        class="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-table-header)]/60 p-3.5"
      >
        <div class="text-xs font-medium text-[var(--text-tertiary)]">
          未知条目
        </div>
        <div
          class="mt-1 font-mono text-xl font-bold text-[var(--text-primary)]"
        >
          {{ affinityStats.unknown }}
        </div>
      </div>
      <div
        class="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-table-header)]/60 p-3.5"
      >
        <div class="text-xs font-medium text-[var(--text-tertiary)]">
          缓存算法
        </div>
        <div
          class="mt-1 font-mono text-base font-bold text-[var(--text-primary)]"
        >
          {{ affinityStats.cache_algo || '—' }}
        </div>
      </div>
    </div>

    <div
      v-else-if="performanceStats"
      class="my-4 grid grid-cols-2 gap-3 sm:grid-cols-4"
    >
      <div
        class="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-table-header)]/60 p-3.5"
      >
        <div class="text-xs font-medium text-[var(--text-tertiary)]">
          磁盘缓存
        </div>
        <div
          class="mt-1 font-mono text-lg font-bold text-[var(--text-primary)]"
        >
          {{ formatBytes(performanceStats.disk_cache_info.total_size) }}
        </div>
      </div>
      <div
        class="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-table-header)]/60 p-3.5"
      >
        <div class="text-xs font-medium text-[var(--text-tertiary)]">
          当前内存
        </div>
        <div
          class="mt-1 font-mono text-lg font-bold text-[var(--text-primary)]"
        >
          {{ formatBytes(performanceStats.memory_stats.alloc) }}
        </div>
      </div>
      <div
        class="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-table-header)]/60 p-3.5"
      >
        <div class="text-xs font-medium text-[var(--text-tertiary)]">
          Goroutine
        </div>
        <div
          class="mt-1 font-mono text-lg font-bold text-[var(--text-primary)]"
        >
          {{ performanceStats.memory_stats.num_goroutine }}
        </div>
      </div>
      <div
        class="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-table-header)]/60 p-3.5"
      >
        <div class="text-xs font-medium text-[var(--text-tertiary)]">
          日志占用
        </div>
        <div
          class="mt-1 font-mono text-lg font-bold text-[var(--text-primary)]"
        >
          {{ formatBytes(logFiles?.total_size) }}
        </div>
      </div>
    </div>

    <template v-if="kind === 'channel-affinity'">
      <div class="mt-4 flex flex-wrap gap-2.5">
        <ConsoleButton
          variant="secondary"
          size="sm"
          @click="pendingAction = 'clear-affinity'"
        >
          清空亲和性缓存
        </ConsoleButton>
      </div>
    </template>
    <template v-else>
      <div class="mt-4 flex flex-wrap gap-2.5">
        <ConsoleButton
          variant="secondary"
          size="sm"
          @click="pendingAction = 'clear-cache'"
        >
          清理磁盘缓存
        </ConsoleButton>
        <ConsoleButton
          variant="secondary"
          size="sm"
          @click="pendingAction = 'reset-stats'"
        >
          重置统计
        </ConsoleButton>
        <ConsoleButton variant="ghost" size="sm" @click="pendingAction = 'gc'">
          执行垃圾回收
        </ConsoleButton>
      </div>
      <div
        class="mt-4 flex flex-wrap items-center gap-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-table-header)]/30 p-3"
      >
        <span class="text-xs font-medium text-[var(--text-secondary)]"
          >日志清理：</span
        >
        <select
          v-model="logCleanupMode"
          class="focus-ring h-8 rounded-lg border border-[var(--border-default)] bg-[var(--surface-solid)] px-2.5 text-xs text-[var(--text-primary)]"
          aria-label="日志清理方式"
        >
          <option value="by_count">保留最新文件数</option>
          <option value="by_days">按保留天数清理</option>
        </select>
        <input
          v-model.number="logCleanupValue"
          type="number"
          min="1"
          class="focus-ring h-8 w-20 rounded-lg border border-[var(--border-default)] bg-[var(--surface-solid)] px-2.5 text-xs text-[var(--text-primary)]"
          aria-label="日志保留值"
        />
        <ConsoleButton
          variant="danger"
          size="sm"
          :disabled="logCleanupValue < 1"
          @click="pendingAction = 'cleanup-logs'"
        >
          清理日志
        </ConsoleButton>
      </div>
    </template>
  </section>

  <ConfirmDialog
    :open="pendingAction !== null"
    :title="actionText.title"
    :message="actionText.message"
    :loading="loading"
    confirm-text="确认执行"
    @cancel="pendingAction = null"
    @confirm="runAction"
  />
</template>
