import { memo, useEffect, useMemo, useState } from 'react'
import { Activity, RotateCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatTimestampToDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useStatus } from '@/hooks/use-status'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { getUptimeStatus } from '@/features/dashboard/api'
import type {
  UptimeGroupResult,
  UptimeMonitor,
} from '@/features/dashboard/types'
import { PanelWrapper } from '../ui/panel-wrapper'

const STATUS_COLOR_MAP: Record<number, string> = {
  1: 'bg-emerald-500',
  0: 'bg-red-500',
  2: 'bg-amber-500',
  3: 'bg-blue-500',
}
const DEFAULT_STATUS_COLOR = 'bg-muted-foreground/40'

const StatusDot = memo(function StatusDot(props: { status: number }) {
  const color = STATUS_COLOR_MAP[props.status] ?? DEFAULT_STATUS_COLOR
  return <span className={cn('inline-block size-2 rounded-full', color)} />
})

function formatUptimeDuration(
  startTime: number | null | undefined,
  nowMs: number,
  t: (key: string) => string
) {
  if (!startTime) {
    return t('Unknown')
  }

  const totalMinutes = Math.max(0, Math.floor((nowMs - startTime * 1000) / 60000))
  const days = Math.floor(totalMinutes / (24 * 60))
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60)
  const minutes = totalMinutes % 60

  const parts: string[] = []

  if (days > 0) {
    parts.push(`${days} ${t(days === 1 ? 'Day' : 'days')}`)
  }
  if (hours > 0) {
    parts.push(`${hours} ${t(hours === 1 ? 'Hour' : 'hours')}`)
  }
  if (minutes > 0 || parts.length === 0) {
    parts.push(`${minutes} ${t(minutes === 1 ? 'Minute' : 'minutes')}`)
  }

  return parts.join(' ')
}

export function UptimePanel() {
  const { t } = useTranslation()
  const { status } = useStatus()
  const [groups, setGroups] = useState<UptimeGroupResult[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now())
    }, 60 * 1000)

    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const abortController = new AbortController()

    getUptimeStatus()
      .then((res) => {
        if (abortController.signal.aborted) return
        setGroups(res?.data || [])
      })
      .catch(() => {
        if (abortController.signal.aborted) return
        setGroups([])
      })
      .finally(() => {
        if (!abortController.signal.aborted) {
          setLoading(false)
        }
      })

    return () => {
      abortController.abort()
    }
  }, [])

  const handleRefresh = () => {
    const abortController = new AbortController()
    setRefreshing(true)

    getUptimeStatus()
      .then((res) => {
        if (abortController.signal.aborted) return
        setGroups(res?.data || [])
      })
      .catch(() => {
        if (abortController.signal.aborted) return
        setGroups([])
      })
      .finally(() => {
        if (!abortController.signal.aborted) {
          setRefreshing(false)
        }
      })
  }

  const startTime =
    (status?.start_time as number | undefined) ??
    (status?.data?.start_time as number | undefined)

  const runtimeCard = useMemo(
    () => ({
      value: formatUptimeDuration(startTime, nowMs, t),
      since: startTime ? formatTimestampToDate(startTime) : t('Unknown'),
    }),
    [nowMs, startTime, t]
  )

  return (
    <PanelWrapper
      title={
        <span className='flex items-center gap-2'>
          <Activity className='text-muted-foreground/60 size-4' />
          {t('Uptime')}
        </span>
      }
      loading={loading}
      height='h-80'
      headerActions={
        <Button
          variant='ghost'
          size='sm'
          onClick={handleRefresh}
          disabled={refreshing}
          className='size-7 p-0'
        >
          <RotateCw
            className={cn('size-3.5', refreshing && 'animate-spin')}
            aria-label={t('Refresh')}
          />
        </Button>
      }
    >
      <div className='space-y-5'>
        <div className='relative overflow-hidden rounded-2xl border border-cyan-500/20 bg-background/85 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_0_28px_rgba(34,211,238,0.08)] backdrop-blur-sm sm:px-5 sm:py-5'>
          <div className='from-border/0 via-cyan-400/70 to-border/0 absolute inset-x-8 top-0 h-px bg-gradient-to-r' />
          <div className='absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-sky-500/10 opacity-90' />
          <div className='absolute -top-10 right-0 h-28 w-28 rounded-full bg-cyan-400/10 blur-3xl' />
          <div className='absolute -bottom-12 left-8 h-28 w-28 rounded-full bg-sky-500/10 blur-3xl' />

          <div className='relative'>
            <div className='mb-3 flex items-start justify-between gap-3'>
              <div className='text-muted-foreground flex items-center gap-2 text-[11px] font-medium tracking-[0.22em] uppercase'>
                <Activity className='size-4 text-cyan-300/80' />
                {t('Uptime')}
              </div>
              <div className='rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-1 font-mono text-[10px] tracking-[0.24em] text-cyan-200 uppercase'>
                Live
              </div>
            </div>

            <div className='bg-gradient-to-r from-cyan-100 via-white to-sky-200 bg-clip-text font-mono text-4xl font-black tracking-tight text-transparent drop-shadow-[0_0_18px_rgba(56,189,248,0.18)] sm:text-5xl'>
              {runtimeCard.value}
            </div>
            <p className='text-muted-foreground/80 mt-2 text-sm'>
              {t('Uptime since')} {runtimeCard.since}
            </p>
          </div>
        </div>

        {groups.length ? (
          <ScrollArea className='h-44'>
            <div className='-mx-4 space-y-0 sm:-mx-5'>
              {groups.map((group, groupIdx) => (
                <div key={group.categoryName}>
                  <div className='bg-muted/30 border-border/60 border-b px-4 py-2 sm:px-5'>
                    <div className='flex items-center gap-2'>
                      <h4 className='text-muted-foreground text-xs font-semibold tracking-wider uppercase'>
                        {group.categoryName}
                      </h4>
                      <span className='text-muted-foreground/40 font-mono text-xs tabular-nums'>
                        {group.monitors?.length || 0}
                      </span>
                    </div>
                  </div>

                  {group.monitors?.map(
                    (monitor: UptimeMonitor, monitorIdx: number) => (
                      <div
                        key={monitor.name}
                        className={cn(
                          'hover:bg-muted/40 flex items-center justify-between px-4 py-2.5 transition-colors sm:px-5',
                          monitorIdx < (group.monitors?.length || 0) - 1 &&
                            'border-border/40 border-b',
                          groupIdx < groups.length - 1 &&
                            monitorIdx === (group.monitors?.length || 0) - 1 &&
                            'border-border/60 border-b'
                        )}
                      >
                        <div className='flex min-w-0 items-center gap-2.5'>
                          <StatusDot status={monitor.status} />
                          <span className='truncate text-sm'>{monitor.name}</span>
                          {monitor.group && (
                            <span className='text-muted-foreground/40 shrink-0 text-xs'>
                              ({monitor.group})
                            </span>
                          )}
                        </div>
                        <span className='text-foreground shrink-0 font-mono text-sm font-semibold tabular-nums'>
                          {((monitor.uptime ?? 0) * 100).toFixed(2)}%
                        </span>
                      </div>
                    )
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className='text-muted-foreground flex h-20 items-center justify-center text-sm'>
            {t('No uptime monitoring configured')}
          </div>
        )}
      </div>
    </PanelWrapper>
  )
}
