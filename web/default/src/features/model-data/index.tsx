import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Settings2 } from 'lucide-react'
import { api } from '@/lib/api'
import { SectionPageLayout } from '@/components/layout'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip'

// ── Types ─────────────────────────────────────────────────────────────────────

interface TopKItem {
  label: string
  score: number
  rank?: number
}

interface DetectPoint {
  status: string       // 'pass' / 'suspicious' / 'notcomplete'
  detect_time: number  // unix seconds
  note?: string
  top5?: TopKItem[]
}

interface ModelDataItem {
  channel_id: number
  channel_name: string
  key_group: string
  input_price: number
  actual_price: number
  recharge_rate: number
  fingerprint_history: DetectPoint[]
  uptime_history: DetectPoint[]
  latency_median_ms: number
  status: number  // 1 enabled / 2 manual-disabled / 3 auto-disabled
  consecutive_fingerprint_pass: number  // recovery counter; meaningful when status=3
}

interface DetectConfig {
  fingerprint_enabled: boolean
  fingerprint_interval_minutes: number
  uptime_enabled: boolean
  uptime_interval_minutes: number
  next_fingerprint_at?: number  // unix sec; 0 means feature off
  next_uptime_at?: number
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MODEL_TABS = [
  { label: 'Haiku 4.5',  modelId: 'claude-haiku-4-5' },
  { label: 'Sonnet 4.6', modelId: 'claude-sonnet-4-6' },
  { label: 'Opus 4.7',   modelId: 'claude-opus-4-7'  },
  { label: 'GPT 5.4',   modelId: 'gpt-5.4'           },
  { label: 'GPT 5.5',   modelId: 'gpt-5.5'           },
]

const UNIT_OPTIONS = [
  { label: '分钟', value: 'minute', toMinutes: (v: number) => v },
  { label: '小时', value: 'hour',   toMinutes: (v: number) => v * 60 },
  { label: '天',   value: 'day',    toMinutes: (v: number) => v * 1440 },
]

const DOT_COUNT = 24       // 2 rows × 12 cols
const DOTS_PER_ROW = 12

function minutesToUnit(minutes: number): { value: number; unit: string } {
  if (minutes % 1440 === 0) return { value: minutes / 1440, unit: 'day' }
  if (minutes % 60   === 0) return { value: minutes / 60,   unit: 'hour' }
  return { value: minutes, unit: 'minute' }
}

function fmtPrice(price: number): string {
  return parseFloat(price.toFixed(4)).toString()
}

// Format unix-sec → "下次 18:42" or "即将 / Xs/Xm" depending on how soon.
// 0 = feature off → empty string.
function fmtNextDetect(unixSec?: number): string {
  if (!unixSec) return ''
  const now = Math.floor(Date.now() / 1000)
  const diff = unixSec - now
  if (diff <= 5) return '即将检测'
  if (diff < 60) return `${diff}s 后`
  if (diff < 3600) return `${Math.round(diff / 60)} 分钟后`
  const d = new Date(unixSec * 1000)
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `下次 ${hh}:${mi}`
}

function fmtTime(ts: number): string {
  const d = new Date(ts * 1000)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${mm}-${dd} ${hh}:${mi}`
}

const STATUS_LABEL: Record<string, string> = {
  pass: '通过',
  suspicious: '可疑',
  notcomplete: '未完成',
}

// ── Sub-components ────────────────────────────────────────────────────────────

/**
 * 24-dot grid (2 rows × 12 cols). Newest on the left of the top row.
 * Each dot hover shows: time + status + note (if any) — instant via TooltipProvider delay=0.
 */
function DotGrid({ history }: { history: DetectPoint[] }) {
  // Display order: oldest (top-left) → newest (bottom-right) — reads like text.
  // Backend returns newest-first, so position i shows history[DOT_COUNT-1-i].
  // Slots without data stay as gray placeholders on the left.
  const items: (DetectPoint | null)[] = []
  for (let i = 0; i < DOT_COUNT; i++) {
    items.push(history[DOT_COUNT - 1 - i] ?? null)
  }

  return (
    <TooltipProvider delay={0}>
      <div className='inline-flex flex-col gap-[3px]'>
        {[0, 1].map((row) => (
          <div key={row} className='flex gap-[3px]'>
            {items.slice(row * DOTS_PER_ROW, (row + 1) * DOTS_PER_ROW).map((p, i) => {
              let cls = 'bg-gray-200'
              if (p?.status === 'pass') cls = 'bg-emerald-500'
              else if (p?.status === 'suspicious') cls = 'bg-amber-400'
              else if (p?.status === 'notcomplete') cls = 'bg-red-400'
              return (
                <Tooltip key={i}>
                  <TooltipTrigger
                    render={
                      <div
                        className={`w-[6px] h-[14px] rounded-[2px] cursor-pointer ${cls}`}
                        style={{ opacity: p ? 1 : 0.3 }}
                      />
                    }
                  />
                  <TooltipContent>
                    {p ? (
                      <div className='flex flex-col gap-1 min-w-[180px] max-w-[420px]'>
                        <div className='flex items-center justify-between gap-3'>
                          <span className='font-mono opacity-80'>{fmtTime(p.detect_time)}</span>
                          <span className='font-medium'>{STATUS_LABEL[p.status] ?? p.status}</span>
                        </div>
                        {p.top5 && p.top5.length > 0 && (
                          <div className='border-t border-white/10 pt-1 mt-0.5 space-y-0.5'>
                            <div className='text-[10px] uppercase opacity-50 tracking-wide'>Top 5</div>
                            {p.top5.map((t, idx) => (
                              <div key={idx} className='flex items-center justify-between gap-3 text-[11px] font-mono'>
                                <span className='truncate'>{idx + 1}. {t.label}</span>
                                <span className='opacity-80 tabular-nums'>{(t.score * 100).toFixed(1)}%</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {p.note && (
                          <div className='text-[11px] opacity-80 whitespace-pre-wrap break-words max-h-[200px] overflow-y-auto border-t border-white/10 pt-1 mt-0.5'>
                            {p.note}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className='opacity-70'>暂无数据</span>
                    )}
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </div>
        ))}
      </div>
    </TooltipProvider>
  )
}

// ── Interval Settings Dialog ──────────────────────────────────────────────────

function IntervalDialog({
  open,
  onClose,
  initialMinutes,
  onSave,
}: {
  open: boolean
  onClose: () => void
  initialMinutes: number
  onSave: (intervalMinutes: number) => void
}) {
  const { value: initVal, unit: initUnit } = minutesToUnit(initialMinutes)
  const [value, setValue] = useState(initVal)
  const [unit, setUnit] = useState(initUnit)

  useEffect(() => {
    if (open) {
      const { value: v, unit: u } = minutesToUnit(initialMinutes)
      setValue(v)
      setUnit(u)
    }
  }, [open, initialMinutes])

  function handleSave() {
    const unitOpt = UNIT_OPTIONS.find((o) => o.value === unit)!
    const safeValue = Number.isFinite(value) && value >= 1 ? value : 1
    onSave(unitOpt.toMinutes(safeValue))
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className='max-w-sm'>
        <DialogHeader>
          <DialogTitle>检测频率设置</DialogTitle>
        </DialogHeader>
        <div className='py-2 space-y-4'>
          <p className='text-sm text-gray-500'>设置自动检测的时间间隔。</p>
          <div className='flex items-center gap-2'>
            <Input
              type='number'
              min={1}
              value={value}
              onFocus={(e) => e.target.select()}
              onChange={(e) => {
                const v = e.target.value
                // Allow empty string while editing — user can clear and retype.
                // The Math.max(1, ...) only applies on save (handleSave).
                setValue(v === '' ? (NaN as unknown as number) : Number(v))
              }}
              className='w-24'
            />
            <div className='flex rounded-md border border-gray-200 overflow-hidden text-sm'>
              {UNIT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setUnit(opt.value)}
                  className={[
                    'px-3 py-1.5 transition-colors',
                    unit === opt.value
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-500 hover:bg-gray-50',
                  ].join(' ')}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={onClose}>取消</Button>
          <Button onClick={handleSave}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function ModelDataPage() {
  const { t } = useTranslation()
  const [activeModel, setActiveModel] = useState(MODEL_TABS[0].modelId)
  const [data, setData] = useState<ModelDataItem[]>([])
  const [loading, setLoading] = useState(false)
  const [config, setConfig] = useState<DetectConfig>({
    fingerprint_enabled: false,
    fingerprint_interval_minutes: 360,
    uptime_enabled: false,
    uptime_interval_minutes: 30,
  })
  const [configLoading, setConfigLoading] = useState(false)
  const [intervalOpen, setIntervalOpen] = useState<'fingerprint' | 'uptime' | null>(null)

  // Fetch table data
  useEffect(() => {
    setLoading(true)
    setData([])
    api
      .get('/api/admin/model-data', { params: { model: activeModel } })
      .then((res) => { if (res.data?.success) setData(res.data.data ?? []) })
      .finally(() => setLoading(false))
  }, [activeModel])

  // Fetch detect config when model changes, then poll every 30s so the
  // "下次 HH:MM" countdown stays fresh as auto-detect ticks fire.
  useEffect(() => {
    const fetchCfg = () => {
      api
        .get('/api/admin/model-detect-config', { params: { model: activeModel } })
        .then((res) => { if (res.data?.success) setConfig(res.data.data) })
    }
    fetchCfg()
    const t = setInterval(fetchCfg, 30_000)
    return () => clearInterval(t)
  }, [activeModel])

  const saveConfig = useCallback(
    (patch: Partial<DetectConfig>) => {
      const next = { ...config, ...patch }
      setConfig(next)
      setConfigLoading(true)
      api
        .post('/api/admin/model-detect-config', {
          model: activeModel,
          fingerprint_enabled: next.fingerprint_enabled,
          fingerprint_interval_minutes: next.fingerprint_interval_minutes,
          uptime_enabled: next.uptime_enabled,
          uptime_interval_minutes: next.uptime_interval_minutes,
        })
        .finally(() => setConfigLoading(false))
    },
    [config, activeModel],
  )

  function fmtInterval(minutes: number) {
    const { value, unit } = minutesToUnit(minutes)
    const label = UNIT_OPTIONS.find((o) => o.value === unit)?.label ?? ''
    return `每 ${value} ${label}`
  }

  // Manual enable/disable from the row button. Mutates server state then
  // refetches the table so the new status (1 / 2) shows up. We don't update
  // local state optimistically — toggling racing with auto-detect could leave
  // stale data, easier to round-trip.
  const toggleChannel = useCallback(
    (channelId: number, currentStatus: number) => {
      const action = currentStatus === 1 ? 'disable' : 'enable'
      api
        .post('/api/admin/model-data/toggle', { channel_id: channelId, action })
        .then(() => {
          // Refresh table
          api
            .get('/api/admin/model-data', { params: { model: activeModel } })
            .then((res) => { if (res.data?.success) setData(res.data.data ?? []) })
        })
    },
    [activeModel],
  )

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Model Data')}</SectionPageLayout.Title>
      <SectionPageLayout.Description>
        {t('Channel pricing and detection stats by model')}
      </SectionPageLayout.Description>
      <SectionPageLayout.Content>

        {/* Tab bar + auto-detect controls */}
        <div className='flex items-center justify-between mb-5'>
          <div className='flex items-center gap-1'>
            {MODEL_TABS.map((tab) => {
              const active = tab.modelId === activeModel
              return (
                <button
                  key={tab.modelId}
                  onClick={() => setActiveModel(tab.modelId)}
                  className={[
                    'px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors',
                    active
                      ? 'bg-gray-900 text-white shadow-sm'
                      : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100',
                  ].join(' ')}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* Auto-detect controls: two rows */}
          <div className='flex flex-col gap-1.5 items-end'>
            {/* 模型检测 */}
            <div className='flex items-center gap-2'>
              <span className='text-xs text-gray-400 w-16 text-right'>模型检测</span>
              <Switch
                id='fp-detect'
                checked={config.fingerprint_enabled}
                disabled={configLoading}
                onCheckedChange={(v) => saveConfig({ fingerprint_enabled: v })}
              />
              <button
                onClick={() => setIntervalOpen('fingerprint')}
                className='flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors border border-gray-200 rounded-md px-2 py-1'
              >
                <Settings2 className='w-3 h-3' />
                {fmtInterval(config.fingerprint_interval_minutes)}
              </button>
              <span className='text-[11px] text-gray-400 min-w-[80px]'>
                {config.fingerprint_enabled ? fmtNextDetect(config.next_fingerprint_at) : ''}
              </span>
            </div>
            {/* 运行状态 */}
            <div className='flex items-center gap-2'>
              <span className='text-xs text-gray-400 w-16 text-right'>运行状态</span>
              <Switch
                id='uptime-detect'
                checked={config.uptime_enabled}
                disabled={configLoading}
                onCheckedChange={(v) => saveConfig({ uptime_enabled: v })}
              />
              <button
                onClick={() => setIntervalOpen('uptime')}
                className='flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors border border-gray-200 rounded-md px-2 py-1'
              >
                <Settings2 className='w-3 h-3' />
                {fmtInterval(config.uptime_interval_minutes)}
              </button>
              <span className='text-[11px] text-gray-400 min-w-[80px]'>
                {config.uptime_enabled ? fmtNextDetect(config.next_uptime_at) : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className='rounded-xl border border-gray-200/80 overflow-hidden bg-white'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='border-b border-gray-100'>
                <th className='text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide'>站点</th>
                <th className='text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide'>站点分组</th>
                <th className='text-right px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide'>
                  实际价格&nbsp;<span className='normal-case font-normal'>$/1M</span>
                </th>
                <th className='text-right px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide'>延迟中位数</th>
                <th className='text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide'>检测结果</th>
                <th className='text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide'>运行状态</th>
                <th className='text-center px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide'>操作</th>
              </tr>
            </thead>
            <tbody className='divide-y divide-gray-50'>
              {loading && (
                <tr>
                  <td colSpan={7} className='px-5 py-12 text-center text-sm text-gray-400'>加载中…</td>
                </tr>
              )}
              {!loading && data.length === 0 && (
                <tr>
                  <td colSpan={7} className='px-5 py-12 text-center text-sm text-gray-400'>
                    暂无数据 — 请在渠道管理中录入支持该模型的渠道
                  </td>
                </tr>
              )}
              {data.map((item) => {
                const isManualDisabled = item.status === 2
                const isAutoDisabled = item.status === 3
                const isEnabled = item.status === 1
                const rowClass = isManualDisabled
                  ? 'opacity-50 hover:bg-gray-50/60 transition-colors'
                  : 'hover:bg-gray-50/60 transition-colors'
                return (
                  <tr key={item.channel_id} className={rowClass}>
                    <td className='px-5 py-3.5 font-medium text-gray-800'>
                      {item.channel_name}
                      {isAutoDisabled && (
                        <span className='ml-2 text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded'>
                          自动禁用 {item.consecutive_fingerprint_pass}/12
                        </span>
                      )}
                      {isManualDisabled && (
                        <span className='ml-2 text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded'>手动禁用</span>
                      )}
                    </td>
                    <td className='px-5 py-3.5 text-gray-500'>{item.key_group || <span className='text-gray-300'>—</span>}</td>
                    <td className='px-5 py-3.5 text-right font-semibold text-gray-800 tabular-nums'>{fmtPrice(item.actual_price)}</td>
                    <td className='px-5 py-3.5 text-right text-gray-600 tabular-nums'>
                      {item.latency_median_ms > 0 ? `${(item.latency_median_ms / 1000).toFixed(1)} s` : <span className='text-gray-300'>—</span>}
                    </td>
                    <td className='px-5 py-3.5'><DotGrid history={item.fingerprint_history} /></td>
                    <td className='px-5 py-3.5'><DotGrid history={item.uptime_history} /></td>
                    <td className='px-5 py-3.5 text-center'>
                      <button
                        onClick={() => toggleChannel(item.channel_id, item.status)}
                        className={
                          isEnabled
                            ? 'text-xs text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 rounded-md px-2.5 py-1 transition-colors'
                            : 'text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border border-emerald-200 rounded-md px-2.5 py-1 transition-colors'
                        }
                      >
                        {isEnabled ? '禁用' : '启用'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <IntervalDialog
          open={intervalOpen === 'fingerprint'}
          onClose={() => setIntervalOpen(null)}
          initialMinutes={config.fingerprint_interval_minutes}
          onSave={(m) => saveConfig({ fingerprint_interval_minutes: m })}
        />
        <IntervalDialog
          open={intervalOpen === 'uptime'}
          onClose={() => setIntervalOpen(null)}
          initialMinutes={config.uptime_interval_minutes}
          onSave={(m) => saveConfig({ uptime_interval_minutes: m })}
        />

      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
