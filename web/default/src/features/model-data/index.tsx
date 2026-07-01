import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Settings2, RefreshCw, AlertTriangle } from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

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
  group_name?: string  // key_group at time of detection
  fingerprint_model_version?: string  // e.g. apimaster_fingerprint_cccli_v0.1
  top5?: TopKItem[]
  top1_score_raw?: number  // raw top1 score before boost; non-zero only when boost was applied
}

interface ModelDataItem {
  channel_id: number
  channel_name: string
  key_group: string
  client_exclusive?: string  // '' | codex | claude_code
  // null when upstream /api/pricing returned 401/404 or cookie-only auth —
  // we have no idea how much this channel costs. UI renders these as "—".
  model_price: number | null       // base price before group markup
  group_ratio: number | null       // upstream group multiplier
  recharge_rate: number            // platform recharge multiplier
  input_price: number | null       // model_price × group_ratio
  actual_price: number | null           // input_price × recharge_rate (采购价)
  user_price: number | null             // actual_price × apimaster_price_ratio (用户最终价格)
  apimaster_price_ratio: number         // per-channel markup; 1.0 when unset
  hub_price: number | null              // hub.romaapi.com listed price, matched by key_group
  output_price?: number | null
  actual_output_price?: number | null
  actual_output_user_price?: number | null  // actual_output_price × apimaster_price_ratio
  cache_price?: number | null           // cache-read price before recharge
  actual_cache_price?: number | null    // cache_price × recharge_rate
  cache_creation_price?: number | null
  actual_cache_creation_price?: number | null
  fingerprint_history: DetectPoint[]
  uptime_history: DetectPoint[]
  latency_median_ms: number
  latency_p95_ms: number
  latency_cv_pct: number
  status: number  // 1 enabled / 2 manual-disabled / 3 auto-disabled
  consecutive_fingerprint_pass: number  // recovery counter; meaningful when status=3
  model_enabled: boolean  // abilities.enabled for this (channel, model) pair
  pricing_source: string  // "api" | "manual" | ""
  status_reason?: string  // why auto-disabled; empty when status !== 3
  status_time?: number    // unix ts of disable event; 0 if unknown
  base_url?: string
}

interface AnalysisState {
  channelName: string
  baseUrl: string
  claimed: string | null
  predicted: string | null
  status: 'idle' | 'loading' | 'done' | 'error'
  text: string
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

type ModelTab = {
  label: string
  modelId: string
  accent: string
}

const MODEL_TABS: ModelTab[] = [
  { label: 'Sonnet 5',        modelId: 'claude-sonnet-5',   accent: '#a855f7' },
  { label: 'GPT 5.4',         modelId: 'gpt-5.4',           accent: '#22d3ee' },
  { label: 'GPT 5.5',         modelId: 'gpt-5.5',           accent: '#22d3ee' },
  { label: 'Sonnet 4.6',      modelId: 'claude-sonnet-4-6', accent: '#a855f7' },
  { label: 'Opus 4.7',        modelId: 'claude-opus-4-7',   accent: '#a855f7' },
  { label: 'Opus 4.8',        modelId: 'claude-opus-4-8',   accent: '#a855f7' },
  { label: 'Haiku 4.5',       modelId: 'claude-haiku-4-5',  accent: '#a855f7' },
  { label: 'DeepSeek Flash',  modelId: 'deepseek-v4-flash', accent: '#a78bfa' },
  { label: 'DeepSeek Pro',    modelId: 'deepseek-v4-pro',   accent: '#a78bfa' },
  { label: 'MiniMax M3',      modelId: 'minimax-m3',        accent: '#f97316' },
  { label: 'Kimi K2.7 Code',  modelId: 'kimi-k2.7-code',    accent: '#818cf8' },
  { label: 'MiMo v2.5 Pro',   modelId: 'mimo-v2.5-pro',     accent: '#f97316' },
  { label: 'MiMo v2.5',       modelId: 'mimo-v2.5',         accent: '#fb923c' },
  { label: 'Qwen 3.7 Max',    modelId: 'qwen3.7-max',       accent: '#06b6d4' },
  { label: 'Qwen 3.7 Plus',   modelId: 'qwen3.7-plus',      accent: '#06b6d4' },
  { label: 'Doubao Seed 2.1 Pro',  modelId: 'doubao-seed-2-1-pro-260628',   accent: '#f97316' },
  { label: 'Doubao Seed 2.1 Turbo', modelId: 'doubao-seed-2-1-turbo-260628', accent: '#fb923c' },
  { label: 'GLM 5.2',         modelId: 'glm-5.2',           accent: '#10b981' },
  { label: 'Gemini 3.1 Pro',  modelId: 'gemini-3.1-pro-preview', accent: '#4285f4' },
  { label: 'Gemini 3.5 Flash', modelId: 'gemini-3.5-flash', accent: '#4285f4' },
  { label: 'Gemini 3.1 Flash Lite', modelId: 'gemini-3.1-flash-lite', accent: '#4285f4' },
  { label: 'Nano Banana 2', modelId: 'gemini-3.1-flash-image-preview', accent: '#4285f4' },
  { label: 'Image 2',         modelId: 'gpt-image-2',       accent: '#22d3ee' },
  { label: 'Sora 2',          modelId: 'sora-2',            accent: '#22d3ee' },
  { label: 'Sora 2 Pro',      modelId: 'sora-2-pro',        accent: '#22d3ee' },
  { label: 'Kling Motion Control', modelId: 'kling-v3-motion-control', accent: '#f97316' },
]

const UNIT_OPTIONS = [
  { label: '分钟', value: 'minute', toMinutes: (v: number) => v },
  { label: '小时', value: 'hour',   toMinutes: (v: number) => v * 60 },
  { label: '天',   value: 'day',    toMinutes: (v: number) => v * 1440 },
]

const DOT_COUNT = 10       // 2 rows × 5 cols
const DOTS_PER_ROW = 5

function minutesToUnit(minutes: number): { value: number; unit: string } {
  if (minutes % 1440 === 0) return { value: minutes / 1440, unit: 'day' }
  if (minutes % 60   === 0) return { value: minutes / 60,   unit: 'hour' }
  return { value: minutes, unit: 'minute' }
}

function fmtPrice(price: number | null | undefined): string {
  // null/undefined → 后端没有 pricing 行（上游不暴露 /api/pricing 或 cookie-only auth）
  // 0/负数 → 异常值，同样视为"无价格"
  // 显示破折号而不是 "0"，避免被误认为"免费"渠道。
  if (price == null || price <= 0) return '—'
  return parseFloat(price.toFixed(4)).toString()
}

function ClientExclusiveBadge({ value }: { value?: string }) {
  if (!value) return <span className='text-gray-300'>—</span>
  const styles: Record<string, string> = {
    codex: 'bg-cyan-100 text-cyan-800',
    claude_code: 'bg-violet-100 text-violet-800',
  }
  const labels: Record<string, string> = {
    codex: 'Codex',
    claude_code: 'CC',
  }
  return (
    <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold ${styles[value] ?? 'bg-gray-100 text-gray-600'}`}>
      {labels[value] ?? value}
    </span>
  )
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
function DotGrid({ history, onAnalyze }: { history: DetectPoint[] | null | undefined; onAnalyze?: () => void }) {
  const safe = history ?? []
  const items: (DetectPoint | null)[] = []
  for (let i = 0; i < DOT_COUNT; i++) {
    items.push(safe[DOT_COUNT - 1 - i] ?? null)
  }

  return (
    <div className='inline-flex flex-col gap-[3px]'>
      {[0, 1].map((row) => (
        <div key={row} className='flex gap-[3px]'>
          {items.slice(row * DOTS_PER_ROW, (row + 1) * DOTS_PER_ROW).map((p, i) => {
            let cls = 'bg-gray-200'
            if (p?.status === 'pass') cls = 'bg-emerald-500'
            else if (p?.status === 'suspicious') cls = 'bg-amber-400'
            else if (p?.status === 'notcomplete') cls = 'bg-red-400'

            const dotEl = (
              <div
                className={`w-[6px] h-[14px] rounded-[2px] ${p ? 'cursor-pointer' : 'cursor-default'} ${cls}`}
                style={{ opacity: p ? 1 : 0.3 }}
              />
            )

            if (!p) return <div key={i}>{dotEl}</div>

            return (
              <Popover key={i}>
                <PopoverTrigger render={dotEl} />
                <PopoverContent
                  side='top'
                  className='min-w-[180px] max-w-[420px] w-auto bg-gray-900 text-white border-gray-700 p-3 text-[12px]'
                >
                  <div className='flex flex-col gap-1'>
                    <div className='flex items-center justify-between gap-3'>
                      <span className='font-mono opacity-80'>{fmtTime(p.detect_time)}</span>
                      <span className='font-medium'>{STATUS_LABEL[p.status] ?? p.status}</span>
                    </div>
                    {p.group_name && (
                      <div className='text-[11px] opacity-70 flex items-center gap-1.5'>
                        分组：<span className='font-mono'>{p.group_name}</span>
                        {p.fingerprint_model_version?.includes('cccli') && (
                          <span className='rounded bg-violet-500/30 px-1 py-0.5 text-[10px] font-medium text-violet-300'>cc cli</span>
                        )}
                        {p.fingerprint_model_version?.includes('kiro') && (
                          <span className='rounded bg-amber-500/30 px-1 py-0.5 text-[10px] font-medium text-amber-300'>kiro</span>
                        )}
                      </div>
                    )}
                    {!p.group_name && (p.fingerprint_model_version?.includes('cccli') || p.fingerprint_model_version?.includes('kiro')) && (
                      <div className='text-[11px] flex items-center gap-1'>
                        {p.fingerprint_model_version?.includes('cccli') && (
                          <span className='rounded bg-violet-500/30 px-1 py-0.5 text-[10px] font-medium text-violet-300'>cc cli</span>
                        )}
                        {p.fingerprint_model_version?.includes('kiro') && (
                          <span className='rounded bg-amber-500/30 px-1 py-0.5 text-[10px] font-medium text-amber-300'>kiro</span>
                        )}
                      </div>
                    )}
                    {p.top5 && p.top5.length > 0 && (
                      <div className='border-t border-white/10 pt-1 mt-0.5 space-y-0.5'>
                        <div className='text-[10px] uppercase opacity-50 tracking-wide'>Top 5</div>
                        {p.top5.map((t, idx) => (
                          <div key={idx} className='flex items-center justify-between gap-3 text-[11px] font-mono'>
                            <span className='truncate'>{idx + 1}. {t.label}</span>
                            <span className='opacity-80 tabular-nums'>
                              {(t.score * 100).toFixed(1)}%
                              {idx === 0 && p.top1_score_raw != null && p.top1_score_raw > 0 && (
                                <span className='ml-1 opacity-50 text-[10px]'>（原：{(p.top1_score_raw * 100).toFixed(1)}%）</span>
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    {p.note && (
                      <div className='text-[11px] opacity-80 whitespace-pre-wrap break-words max-h-[200px] overflow-y-auto border-t border-white/10 pt-1 mt-0.5'>
                        {p.note}
                      </div>
                    )}
                    {onAnalyze && (
                      <button
                        onClick={onAnalyze}
                        className='mt-1.5 w-full border-t border-white/10 pt-1.5 text-left text-[11px] text-sky-400 hover:text-sky-300 transition-colors'
                      >
                        查看分析 →
                      </button>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            )
          })}
        </div>
      ))}
    </div>
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

// ── Analysis Modal ────────────────────────────────────────────────────────────

function AnalysisModal({ state, onClose }: { state: AnalysisState; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className='max-w-3xl w-full'>
        <DialogHeader>
          <DialogTitle className='text-lg'>渠道检测分析 — {state.channelName}</DialogTitle>
          {(state.claimed || state.predicted) && (
            <p className='text-xs text-gray-500 mt-1'>
              {state.claimed && <>声称：<span className='text-gray-700'>{state.claimed}</span></>}
              {state.claimed && state.predicted && <span className='mx-1.5 text-gray-300'>·</span>}
              {state.predicted && <>预测：<span className='text-gray-700'>{state.predicted}</span></>}
            </p>
          )}
        </DialogHeader>
        <div className='max-h-[75vh] overflow-y-auto py-3'>
          {state.status === 'loading' && (
            <div className='flex items-center gap-2 text-sm text-gray-500 py-4'>
              <RefreshCw className='w-4 h-4 animate-spin' />
              正在分析…
            </div>
          )}
          {state.status === 'error' && (
            <p className='text-sm text-red-500 py-2'>{state.text}</p>
          )}
          {state.status === 'done' && (
            <div className='space-y-1 text-sm leading-relaxed text-gray-700'>
              {state.text.split('\n').map((line, i) => {
                const h2 = line.match(/^##\s+(.*)/)
                const h3 = line.match(/^###\s+(.*)/)
                if (h2) return <p key={i} className='mt-3 text-base font-semibold text-gray-900'>{h2[1]}</p>
                if (h3) return <p key={i} className='mt-2 font-semibold text-gray-800'>{h3[1]}</p>
                const rendered = line
                  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                  .replace(/`(.+?)`/g, "<code class='font-mono text-xs bg-gray-100 px-1 rounded'>$1</code>")
                return line.trim() === ''
                  ? <div key={i} className='h-1' />
                  : <p key={i} dangerouslySetInnerHTML={{ __html: rendered }} />
              })}
            </div>
          )}
        </div>
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
  // True during the initial config fetch for the active model tab.
  // Keeps the toggles visually disabled so users don't see a misleading "OFF" flash.
  const [configFetching, setConfigFetching] = useState(true)
  const [intervalOpen, setIntervalOpen] = useState<'fingerprint' | 'uptime' | null>(null)
  // refreshing pricing for the current model tab (background task, button shows spinner)
  const [pricingRefreshing, setPricingRefreshing] = useState(false)
  const [pricingRefreshMsg, setPricingRefreshMsg] = useState<string>('')
  const [hubRefreshing, setHubRefreshing] = useState(false)
  const [hubRefreshMsg, setHubRefreshMsg] = useState<string>('')
  const [publicRefreshing, setPublicRefreshing] = useState(false)
  const [publicRefreshMsg, setPublicRefreshMsg] = useState<string>('')
  // modelId → true if fingerprint_enabled OR uptime_enabled (for tab dot style)
  const [tabDetectEnabled, setTabDetectEnabled] = useState<Record<string, boolean>>({})

  // Fetch detect config for all tabs once on mount to show filled/hollow dots
  useEffect(() => {
    const models = MODEL_TABS.map((tab) => tab.modelId).join(',')
    api
      .get('/api/admin/model-detect-config/batch', {
        params: { models },
        skipErrorHandler: true,
      } as Parameters<typeof api.get>[1])
      .then((res) => {
        const batch = (res.data?.data ?? {}) as Record<string, DetectConfig>
        setTabDetectEnabled(
          Object.fromEntries(
            MODEL_TABS.map((tab) => [
              tab.modelId,
              !!(
                batch[tab.modelId]?.fingerprint_enabled ||
                batch[tab.modelId]?.uptime_enabled
              ),
            ])
          )
        )
      })
      .catch(() => {
        setTabDetectEnabled(Object.fromEntries(MODEL_TABS.map((tab) => [tab.modelId, false])))
      })
  }, [])

  // Per-channel detecting state: "channelId-modelId" → true while in-flight
  // Keyed by both channel and model so different model tabs don't share detecting state.
  const [detectingChannels, setDetectingChannels] = useState<Record<string, boolean>>({})
  const [pingingChannels, setPingingChannels] = useState<Record<string, boolean>>({})
  const [analysis, setAnalysis] = useState<AnalysisState | null>(null)

  // Fetch table data
  useEffect(() => {
    setLoading(true)
    setData([])
    api
      .get('/api/admin/model-data', { params: { model: activeModel } })
      .then((res) => {
        if (res.data?.success) {
          const raw: ModelDataItem[] = res.data.data ?? []
          // Sort: enabled (model_enabled+status=1) by user_price asc,
          // then disabled by user_price asc, then no-price last.
          // 与公开市场页一致，按用户最终价格排序。
          const sorted = [...raw].sort((a, b) => {
            const aOn = a.model_enabled !== false && a.status === 1
            const bOn = b.model_enabled !== false && b.status === 1
            if (aOn !== bOn) return aOn ? -1 : 1
            const aP = a.user_price != null && a.user_price > 0
            const bP = b.user_price != null && b.user_price > 0
            if (aP !== bP) return aP ? -1 : 1
            return (a.user_price ?? Infinity) - (b.user_price ?? Infinity)
          })
          setData(sorted)
        }
      })
      .finally(() => setLoading(false))
  }, [activeModel])

  // Fetch detect config when model changes, then poll every 30s so the
  // "下次 HH:MM" countdown stays fresh as auto-detect ticks fire.
  // The `cancelled` flag prevents stale in-flight responses from a previous tab
  // from overwriting the config after the user has already switched tabs.
  useEffect(() => {
    let cancelled = false
    setConfigFetching(true)

    const fetchCfg = () => {
      api
        .get('/api/admin/model-detect-config', {
          params: { model: activeModel },
          skipErrorHandler: true,
        } as Parameters<typeof api.get>[1])
        .then((res) => {
          if (!cancelled) {
            if (res.data?.success) setConfig(res.data.data)
            setConfigFetching(false) // always clear loading after first response
          }
        })
        .catch(() => { if (!cancelled) setConfigFetching(false) })
    }
    fetchCfg()
    const t = setInterval(fetchCfg, 30_000)
    return () => { cancelled = true; clearInterval(t) }
  }, [activeModel])

  // Trigger upstream /api/pricing re-fetch for every channel that serves the
  // current model tab. Fire-and-forget on the backend — wait ~6s then reload
  // the table so freshly upserted channel_model_pricings rows show up.
  const refreshPricing = useCallback(() => {
    if (pricingRefreshing) return
    setPricingRefreshing(true)
    setPricingRefreshMsg('')
    api
      .post('/api/admin/model-data/refresh-pricing', {})
      .then((res) => {
        const n = res.data?.count ?? 0
        setPricingRefreshMsg(`已触发 ${n} 个渠道刷新…`)
      })
      .catch(() => setPricingRefreshMsg('刷新失败'))
      .finally(() => {
        // wait for background goroutines to land in DB, then reload table
        setTimeout(() => {
          api
            .get('/api/admin/model-data', { params: { model: activeModel } })
            .then((res) => { if (res.data?.success) setData(res.data.data ?? []) })
            .finally(() => {
              setPricingRefreshing(false)
              setPricingRefreshMsg('')
            })
        }, 6000)
      })
  }, [activeModel, pricingRefreshing])

  // Re-fetch hub.romaapi.com aggregator pricing (clears the backend TTL cache),
  // then reload the table so the HUB 价格 column shows fresh values.
  const refreshHubPrice = useCallback(() => {
    if (hubRefreshing) return
    setHubRefreshing(true)
    setHubRefreshMsg('')
    api
      .post('/api/admin/model-data/refresh-hub-price')
      .then((res) => {
        const n = res.data?.count ?? 0
        setHubRefreshMsg(`已刷新 ${n} 个站点`)
      })
      .catch(() => setHubRefreshMsg('刷新失败'))
      .finally(() => {
        api
          .get('/api/admin/model-data', { params: { model: activeModel } })
          .then((res) => { if (res.data?.success) setData(res.data.data ?? []) })
          .finally(() => {
            setHubRefreshing(false)
            setHubRefreshMsg('')
          })
      })
  }, [activeModel, hubRefreshing])

  // Sync romaapi reference prices into public_model_prices (manual_group_ratio fallback).
  const refreshPublicPrices = useCallback(() => {
    if (publicRefreshing) return
    setPublicRefreshing(true)
    setPublicRefreshMsg('')
    api
      .post('/api/admin/model-data/refresh-public-prices')
      .then((res) => {
        const n = res.data?.count ?? 0
        setPublicRefreshMsg(`已同步 ${n} 条`)
      })
      .catch(() => setPublicRefreshMsg('同步失败'))
      .finally(() => {
        api
          .get('/api/admin/model-data', { params: { model: activeModel } })
          .then((res) => { if (res.data?.success) setData(res.data.data ?? []) })
          .finally(() => {
            setPublicRefreshing(false)
            setPublicRefreshMsg('')
          })
      })
  }, [activeModel, publicRefreshing])

  const detectNow = useCallback((channelId: number) => {
    const key = `${channelId}-${activeModel}`
    if (detectingChannels[key]) return
    setDetectingChannels((prev) => ({ ...prev, [key]: true }))
    api
      .post('/api/admin/model-data/detect-now', { channel_id: channelId, model: activeModel })
      .catch(() => {/* fire-and-forget; failure is visible in dot-grid */})
      .finally(() => {
        // Detection takes ~5-15s on Flask side; reload after 18s to catch result
        setTimeout(() => {
          api
            .get('/api/admin/model-data', { params: { model: activeModel } })
            .then((res) => { if (res.data?.success) setData(res.data.data ?? []) })
            .finally(() => setDetectingChannels((prev) => ({ ...prev, [key]: false })))
        }, 18000)
      })
  }, [activeModel, detectingChannels])

  const pingNow = useCallback((channelId: number) => {
    const key = `${channelId}-${activeModel}`
    if (pingingChannels[key]) return
    setPingingChannels((prev) => ({ ...prev, [key]: true }))
    api
      .post('/api/admin/model-data/ping-now', { channel_id: channelId, model: activeModel })
      .catch(() => {/* fire-and-forget; failure is visible in uptime dot-grid */})
      .finally(() => {
        // Uptime probe takes a few seconds; reload after 8s to catch result
        setTimeout(() => {
          api
            .get('/api/admin/model-data', { params: { model: activeModel } })
            .then((res) => { if (res.data?.success) setData(res.data.data ?? []) })
            .finally(() => setPingingChannels((prev) => ({ ...prev, [key]: false })))
        }, 8000)
      })
  }, [activeModel, pingingChannels])

  const saveConfig = useCallback(
    (patch: Partial<DetectConfig>) => {
      const next = { ...config, ...patch }
      setConfig(next)
      setTabDetectEnabled((prev) => ({
        ...prev,
        [activeModel]: !!(next.fingerprint_enabled || next.uptime_enabled),
      }))
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

  const handleAnalyze = useCallback(async (item: ModelDataItem) => {
    if (!item.base_url) return
    setAnalysis({
      channelName: item.channel_name,
      baseUrl: item.base_url,
      claimed: null,
      predicted: null,
      status: 'loading',
      text: '',
    })
    try {
      const res = await fetch(`/api/channel-analysis?base_url=${encodeURIComponent(item.base_url)}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setAnalysis((prev) => prev ? {
        ...prev,
        claimed: data.claimed_model ?? null,
        predicted: data.predicted_top1 ?? null,
        status: 'done',
        text: data.analysis ?? '（无分析内容）',
      } : null)
    } catch (e) {
      setAnalysis((prev) => prev ? {
        ...prev,
        status: 'error',
        text: e instanceof Error ? e.message : '分析失败',
      } : null)
    }
  }, [])

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
    (channelId: number, modelEnabled: boolean) => {
      const action = modelEnabled ? 'disable' : 'enable'
      api
        .post('/api/admin/model-data/toggle', { channel_id: channelId, model: activeModel, action })
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

        {/* Model tabs + toolbar */}
        <div className='mb-5 space-y-3'>
          <div className='-mx-1 overflow-x-auto pb-1'>
            <div className='flex min-w-max flex-wrap items-center gap-1.5 px-1'>
              {MODEL_TABS.map((tab) => {
                const active = tab.modelId === activeModel
                return (
                  <button
                    key={tab.modelId}
                    type='button'
                    onClick={() => setActiveModel(tab.modelId)}
                    className={[
                      'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all',
                      active
                        ? 'border-gray-900 bg-gray-900 text-white shadow-sm'
                        : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-800',
                    ].join(' ')}
                    style={active ? { boxShadow: `0 0 0 2px white, 0 0 0 4px ${tab.accent}55` } : undefined}
                  >
                    <span
                      className='size-1.5 shrink-0 rounded-full'
                      style={
                        tabDetectEnabled[tab.modelId]
                          ? { backgroundColor: tab.accent, boxShadow: active ? `0 0 6px ${tab.accent}` : undefined }
                          : { border: `1.5px solid ${tab.accent}`, backgroundColor: 'transparent' }
                      }
                    />
                    {tab.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className='flex flex-wrap items-center justify-between gap-3'>
            <div className='flex flex-wrap items-center gap-2'>
            <button
              onClick={refreshPricing}
              disabled={pricingRefreshing}
              className='inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-500 transition-colors hover:border-gray-300 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-50'
              title='各渠道上游 /api/pricing → channel_model_pricings'
            >
              <RefreshCw className={`w-3.5 h-3.5 ${pricingRefreshing ? 'animate-spin' : ''}`} />
              {pricingRefreshing ? (pricingRefreshMsg || '刷新中…') : '刷新价格'}
            </button>
            <button
              onClick={refreshPublicPrices}
              disabled={publicRefreshing}
              className='inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-500 transition-colors hover:border-gray-300 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-50'
              title='api.romaapi.com 公开参考价 → public_model_prices（manual_group_ratio 兜底）'
            >
              <RefreshCw className={`w-3.5 h-3.5 ${publicRefreshing ? 'animate-spin' : ''}`} />
              {publicRefreshing ? (publicRefreshMsg || '同步中…') : '刷新公开价'}
            </button>
            <button
              onClick={refreshHubPrice}
              disabled={hubRefreshing}
              className='inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-500 transition-colors hover:border-gray-300 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-50'
              title='hub.romaapi.com 聚合价（HUB 价格列）'
            >
              <RefreshCw className={`w-3.5 h-3.5 ${hubRefreshing ? 'animate-spin' : ''}`} />
              {hubRefreshing ? (hubRefreshMsg || '刷新中…') : '刷新 Hub 价格'}
            </button>
            </div>

          {/* Auto-detect controls: two rows */}
          <div className='flex flex-col gap-1.5 items-end'>
            {/* 模型检测 */}
            <div className='flex items-center gap-2'>
              <span className='text-xs text-gray-400 w-16 text-right'>模型检测</span>
              <Switch
                id='fp-detect'
                checked={config.fingerprint_enabled}
                disabled={configLoading || configFetching}
                onCheckedChange={(v) => saveConfig({ fingerprint_enabled: v })}
              />
              <button
                onClick={() => setIntervalOpen('fingerprint')}
                disabled={configFetching}
                className='flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors border border-gray-200 rounded-md px-2 py-1 disabled:opacity-40 disabled:cursor-not-allowed'
              >
                <Settings2 className='w-3 h-3' />
                {configFetching ? '…' : fmtInterval(config.fingerprint_interval_minutes)}
              </button>
              <span className='text-[11px] text-gray-400 min-w-[80px]'>
                {!configFetching && config.fingerprint_enabled ? fmtNextDetect(config.next_fingerprint_at) : ''}
              </span>
            </div>
            {/* 运行状态 */}
            <div className='flex items-center gap-2'>
              <span className='text-xs text-gray-400 w-16 text-right'>运行状态</span>
              <Switch
                id='uptime-detect'
                checked={config.uptime_enabled}
                disabled={configLoading || configFetching}
                onCheckedChange={(v) => saveConfig({ uptime_enabled: v })}
              />
              <button
                onClick={() => setIntervalOpen('uptime')}
                disabled={configFetching}
                className='flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors border border-gray-200 rounded-md px-2 py-1 disabled:opacity-40 disabled:cursor-not-allowed'
              >
                <Settings2 className='w-3 h-3' />
                {configFetching ? '…' : fmtInterval(config.uptime_interval_minutes)}
              </button>
              <span className='text-[11px] text-gray-400 min-w-[80px]'>
                {!configFetching && config.uptime_enabled ? fmtNextDetect(config.next_uptime_at) : ''}
              </span>
            </div>
          </div>
          </div>
        </div>

        {/* Enabled count */}
        {!loading && data.length > 0 && (() => {
          const enabledCount = data.filter(
            (it) => it.model_enabled !== false && it.status === 1,
          ).length
          return (
            <div className='mb-3 text-sm text-gray-500'>
              <span className='font-medium text-gray-800'>{enabledCount}</span> 个启用
              <span className='text-gray-300 mx-1.5'>/</span>
              {data.length} 个渠道
            </div>
          )
        })()}

        {/* Table */}
        <div className='rounded-xl border border-gray-200/80 overflow-x-auto bg-white'>
          <table className='w-full min-w-max text-sm'>
            <thead>
              <tr className='border-b border-gray-100'>
                <th className='text-left px-3 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide'>ID</th>
                <th className='text-left px-3 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide w-36'>站点</th>
                <th className='text-left px-3 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide'>站点分组</th>
                <th className='text-left px-3 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide'>客户端</th>
                <th className='text-right px-3 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide'>充值汇率</th>
                <th className='text-right px-2 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide'>gratio</th>
                <th className='text-right px-2 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide w-16'>
                  <div className='flex flex-col items-end leading-tight gap-0.5'>
                    <span>模型价格</span><span className='normal-case font-normal'>$/1M</span>
                  </div>
                </th>
                <th className='text-right px-2 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide w-20'>
                  <div className='flex flex-col items-end leading-tight gap-0.5'>
                    <span>采购价</span><span className='normal-case font-normal'>$/1M</span>
                  </div>
                </th>
                <th className='text-right px-2 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide w-16'>
                  <div className='flex flex-col items-end leading-tight gap-0.5'>
                    <span>用户价格</span><span className='normal-case font-normal'>$/1M</span>
                  </div>
                </th>
                <th className='text-right px-2 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide w-16'>
                  <div className='flex flex-col items-end leading-tight gap-0.5'>
                    <span>HUB 价格</span><span className='normal-case font-normal'>$/1M</span>
                  </div>
                </th>
                <th className='text-right px-3 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide'>延迟</th>
                <th className='text-right px-3 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide'>P95</th>
                <th className='text-right px-3 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide'>波动</th>
                <th className='text-left px-3 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide'>检测结果</th>
                <th className='text-left px-3 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide'>运行状态</th>
                <th className='text-center px-3 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide'>操作</th>
              </tr>
            </thead>
            <tbody className='divide-y divide-gray-50'>
              {loading && (
                <tr>
                  <td colSpan={16} className='px-5 py-12 text-center text-sm text-gray-400'>加载中…</td>
                </tr>
              )}
              {!loading && data.length === 0 && (
                <tr>
                  <td colSpan={16} className='px-5 py-12 text-center text-sm text-gray-400'>
                    暂无数据 — 请在渠道管理中录入支持该模型的渠道
                  </td>
                </tr>
              )}
              {data.map((item) => {
                const isAutoDisabled = item.status === 3
                const isModelEnabled = item.model_enabled !== false  // default true if field missing
                // Effectively enabled = model ability on AND channel not disabled/auto-disabled
                const isEffectivelyEnabled = isModelEnabled && item.status === 1
                // dim when this specific model is disabled on this channel
                const dim = !isModelEnabled ? 'opacity-40' : ''
                // Price divergence alert: actual vs hub > 10%
                const hasBothPrices =
                  item.actual_price != null && item.actual_price > 0 &&
                  item.hub_price != null && item.hub_price > 0
                const priceDivergePct = hasBothPrices
                  ? Math.abs(item.actual_price! - item.hub_price!) / item.hub_price! * 100
                  : 0
                const priceDivergent = priceDivergePct > 10
                return (
                  <tr key={item.channel_id} className='hover:bg-gray-50/60 transition-colors'>
                    <td className={`px-3 py-2.5 text-gray-400 tabular-nums text-xs ${dim}`}>{item.channel_id}</td>
                    <td className={`px-3 py-2.5 font-medium text-gray-800 w-36 max-w-[144px] ${dim}`}>
                      <div className='flex flex-col gap-0.5'>
                        <span className='truncate'>{item.channel_name}</span>
                        <div className='flex flex-wrap gap-1'>
                          {isAutoDisabled && (
                            <TooltipProvider delay={0}>
                              <Tooltip>
                                <TooltipTrigger render={<span />}>
                                  <span className='inline-flex items-center gap-1 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400 cursor-help'>
                                    <AlertTriangle size={10} />
                                    已禁用 {item.consecutive_fingerprint_pass}/12
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent className='max-w-xs'>
                                  <div className='space-y-1 text-xs'>
                                    <div className='font-medium text-red-400'>渠道已自动禁用</div>
                                    {item.status_reason && <div>原因：{item.status_reason}</div>}
                                    {item.status_time && item.status_time > 0 && (
                                      <div>时间：{fmtTime(item.status_time)}</div>
                                    )}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          {!isModelEnabled && (
                            <span className='text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded'>已禁用</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className={`px-3 py-2.5 text-gray-500 ${dim}`}>{item.key_group || <span className='text-gray-300'>—</span>}</td>
                    <td className={`px-3 py-2.5 ${dim}`}>
                      <ClientExclusiveBadge value={item.client_exclusive} />
                    </td>
                    <td className={`px-3 py-2.5 text-right text-gray-500 tabular-nums text-xs ${dim}`}>
                      {item.recharge_rate != null ? item.recharge_rate.toFixed(4) : <span className='text-gray-300'>—</span>}
                    </td>
                    <td className={`px-2 py-3.5 text-right text-gray-500 tabular-nums text-xs ${dim}`}>
                      {item.group_ratio != null ? item.group_ratio.toFixed(3) : <span className='text-gray-300'>—</span>}
                    </td>
                    <td className={`px-2 py-2.5 text-right text-gray-600 tabular-nums ${dim}`}>{fmtPrice(item.model_price)}</td>
                    <td className={`px-2 py-2.5 text-right font-semibold tabular-nums ${priceDivergent ? 'text-red-600' : 'text-gray-800'} ${dim}`}>
                      <TooltipProvider delay={0}>
                      <Tooltip>
                        <TooltipTrigger render={
                          <div className='inline-flex items-center gap-1.5 justify-end cursor-default'>
                            {item.pricing_source === 'manual' && (
                              <span className='text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 leading-none'>手动</span>
                            )}
                            {item.pricing_source === 'api' && (
                              <span className='text-[10px] font-medium px-1.5 py-0.5 rounded bg-green-100 text-green-700 leading-none'>pricing</span>
                            )}
                            {priceDivergent && (
                              <span className='text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-600 leading-none'>
                                !{Math.round(priceDivergePct)}%
                              </span>
                            )}
                            {fmtPrice(item.actual_price)}
                          </div>
                        } />
                        <TooltipContent>
                          {item.actual_price != null && item.actual_price > 0 ? (
                            <div className='flex flex-col gap-1 text-[12px] min-w-[160px]'>
                              <div className='flex justify-between gap-4'>
                                <span className='opacity-70'>输入</span>
                                <span className='font-mono'>{fmtPrice(item.actual_price)}</span>
                              </div>
                              <div className='flex justify-between gap-4'>
                                <span className='opacity-70'>输出</span>
                                <span className='font-mono'>{fmtPrice(item.actual_output_price)}</span>
                              </div>
                              <div className='flex justify-between gap-4'>
                                <span className='opacity-70'>缓存读</span>
                                <span className='font-mono'>{fmtPrice(item.actual_cache_price)}</span>
                              </div>
                              <div className='flex justify-between gap-4'>
                                <span className='opacity-70'>缓存写</span>
                                <span className='font-mono'>{fmtPrice(item.actual_cache_creation_price)}</span>
                              </div>
                              {priceDivergent && (
                                <div className='border-t border-white/10 pt-1 mt-0.5 text-red-300'>
                                  与 Hub 偏差 {Math.round(priceDivergePct)}%（Hub 输入: {fmtPrice(item.hub_price)}）
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className='opacity-70'>暂无价格数据</span>
                          )}
                        </TooltipContent>
                      </Tooltip>
                      </TooltipProvider>
                    </td>
                    <td className={`px-2 py-2.5 text-right font-semibold tabular-nums text-emerald-700 ${dim}`}>
                      {fmtPrice(item.user_price)}
                      {item.apimaster_price_ratio != null && item.apimaster_price_ratio !== 1 && (
                        <span className='ml-1 text-[10px] font-normal text-emerald-500'>×{item.apimaster_price_ratio.toFixed(2)}</span>
                      )}
                    </td>
                    <td className={`px-2 py-2.5 text-right text-gray-500 tabular-nums ${dim}`}>{fmtPrice(item.hub_price)}</td>
                    <td className={`px-3 py-2.5 text-right text-gray-600 tabular-nums ${dim}`}>
                      {item.latency_median_ms > 0 ? `${(item.latency_median_ms / 1000).toFixed(1)} s` : <span className='text-gray-300'>—</span>}
                    </td>
                    <td className={`px-3 py-2.5 text-right text-gray-600 tabular-nums ${dim}`}>
                      {item.latency_p95_ms > 0 ? `${(item.latency_p95_ms / 1000).toFixed(1)} s` : <span className='text-gray-300'>—</span>}
                    </td>
                    <td className={`px-3 py-2.5 text-right tabular-nums ${dim}`}>
                      {item.latency_cv_pct > 0 ? (
                        <span className={item.latency_cv_pct > 60 ? 'text-rose-500' : item.latency_cv_pct > 30 ? 'text-amber-500' : 'text-gray-500'}>
                          {item.latency_cv_pct.toFixed(0)}%
                        </span>
                      ) : <span className='text-gray-300'>—</span>}
                    </td>
                    <td className={`px-3 py-2.5 ${dim}`}>
                      <DotGrid
                        history={item.fingerprint_history}
                        onAnalyze={item.base_url ? () => handleAnalyze(item) : undefined}
                      />
                    </td>
                    <td className={`px-3 py-2.5 ${dim}`}><DotGrid history={item.uptime_history} /></td>
                    <td className='px-3 py-2.5 text-center'>
                      <div className='flex items-center justify-center gap-2'>
                        <button
                          onClick={() => detectNow(item.channel_id)}
                          disabled={!!detectingChannels[`${item.channel_id}-${activeModel}`]}
                          className='text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 border border-blue-200 rounded-md px-2.5 py-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap'
                          title='立即触发一次指纹检测，结果约 15–20s 后显示在检测结果列'
                        >
                          {detectingChannels[`${item.channel_id}-${activeModel}`] ? '检测中…' : '手动检测'}
                        </button>
                        <button
                          onClick={() => pingNow(item.channel_id)}
                          disabled={!!pingingChannels[`${item.channel_id}-${activeModel}`]}
                          className='text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border border-emerald-200 rounded-md px-2.5 py-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap'
                          title='立即触发一次运行状态(uptime)检测，结果约 8s 后显示在运行状态列'
                        >
                          {pingingChannels[`${item.channel_id}-${activeModel}`] ? 'ping 中…' : '手动 ping'}
                        </button>
                        <button
                          onClick={() => toggleChannel(item.channel_id, isEffectivelyEnabled)}
                          className={
                            isEffectivelyEnabled
                              ? 'text-xs text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 rounded-md px-2.5 py-1 transition-colors'
                              : 'text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border border-emerald-200 rounded-md px-2.5 py-1 transition-colors'
                          }
                        >
                          {isEffectivelyEnabled ? '禁用' : '启用'}
                        </button>
                      </div>
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
        {analysis && (
          <AnalysisModal state={analysis} onClose={() => setAnalysis(null)} />
        )}

      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
