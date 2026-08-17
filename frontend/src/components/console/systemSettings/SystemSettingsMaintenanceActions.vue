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
  | 'clear-affinity'
  | 'clear-cache'
  | 'reset-stats'
  | 'gc'
  | 'cleanup-logs'

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
      return { title: '清空渠道亲和性缓存', message: '现有用户的渠道绑定将被移除。' }
    case 'clear-cache':
      return { title: '清理磁盘缓存', message: '将删除不活跃的磁盘缓存文件。' }
    case 'reset-stats':
      return { title: '重置缓存统计', message: '将重置磁盘缓存的命中与未命中统计。' }
    case 'gc':
      return { title: '执行垃圾回收', message: '将立即执行 Go 运行时垃圾回收。' }
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
  <section class="settings-maintenance-actions">
    <div class="settings-maintenance-header">
      <div>
        <h3>运行状态与维护</h3>
        <p v-if="loadingStats">正在获取最新运行状态。</p>
        <p v-else-if="kind === 'channel-affinity'">
          缓存 {{ affinityStats?.total ?? 0 }} 条，容量 {{ affinityStats?.cache_capacity ?? 0 }}。
        </p>
        <p v-else>
          缓存命中率 {{ cacheHitRate }}，日志文件 {{ logFiles?.file_count ?? 0 }} 个。
        </p>
      </div>
      <ConsoleButton variant="ghost" size="sm" :loading="loadingStats" @click="loadStats">
        刷新
      </ConsoleButton>
    </div>

    <dl v-if="kind === 'channel-affinity' && affinityStats" class="settings-maintenance-stats">
      <div><dt>缓存条目</dt><dd>{{ affinityStats.total }}</dd></div>
      <div><dt>未知条目</dt><dd>{{ affinityStats.unknown }}</dd></div>
      <div><dt>缓存算法</dt><dd>{{ affinityStats.cache_algo || '—' }}</dd></div>
    </dl>
    <dl v-else-if="performanceStats" class="settings-maintenance-stats">
      <div><dt>磁盘缓存</dt><dd>{{ formatBytes(performanceStats.disk_cache_info.total_size) }}</dd></div>
      <div><dt>当前内存</dt><dd>{{ formatBytes(performanceStats.memory_stats.alloc) }}</dd></div>
      <div><dt>Goroutine</dt><dd>{{ performanceStats.memory_stats.num_goroutine }}</dd></div>
      <div><dt>日志占用</dt><dd>{{ formatBytes(logFiles?.total_size) }}</dd></div>
    </dl>

    <template v-if="kind === 'channel-affinity'">
      <ConsoleButton variant="secondary" size="sm" @click="pendingAction = 'clear-affinity'">
        清空亲和性缓存
      </ConsoleButton>
    </template>
    <template v-else>
      <div class="settings-maintenance-controls">
        <ConsoleButton variant="secondary" size="sm" @click="pendingAction = 'clear-cache'">
          清理磁盘缓存
        </ConsoleButton>
        <ConsoleButton variant="secondary" size="sm" @click="pendingAction = 'reset-stats'">
          重置统计
        </ConsoleButton>
        <ConsoleButton variant="ghost" size="sm" @click="pendingAction = 'gc'">
          执行垃圾回收
        </ConsoleButton>
      </div>
      <div class="settings-log-cleanup">
        <select v-model="logCleanupMode" aria-label="日志清理方式">
          <option value="by_count">保留最新文件数</option>
          <option value="by_days">按保留天数清理</option>
        </select>
        <input v-model.number="logCleanupValue" type="number" min="1" aria-label="日志保留值" />
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

<style scoped>
.settings-maintenance-actions {
  margin-top: 1.5rem;
  border-top: 1px dashed var(--border-default);
  padding-top: 1rem;
  color: var(--text-secondary);
  font-size: 0.8125rem;
}
.settings-maintenance-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}
.settings-maintenance-header h3 {
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--text-primary);
}
.settings-maintenance-header p {
  margin-top: 0.25rem;
}
.settings-maintenance-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.75rem;
  margin: 1rem 0;
}
.settings-maintenance-stats dt {
  font-size: 0.6875rem;
  color: var(--text-tertiary);
}
.settings-maintenance-stats dd {
  margin-top: 0.125rem;
  overflow-wrap: anywhere;
  font-weight: 700;
  color: var(--text-primary);
}
.settings-maintenance-controls,
.settings-log-cleanup {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.75rem;
}
.settings-log-cleanup select,
.settings-log-cleanup input {
  min-width: 8rem;
  height: 2rem;
  border: 1px solid var(--border-default);
  border-radius: var(--sketch-border-radius-sm);
  background: transparent;
  padding: 0 0.5rem;
  color: var(--text-primary);
}
@media (max-width: 767px) {
  .settings-maintenance-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
