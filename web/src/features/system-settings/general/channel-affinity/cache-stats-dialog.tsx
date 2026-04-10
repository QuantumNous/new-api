import { useEffect, useMemo, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { formatTimestampToDate } from '@/lib/format'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { getAffinityUsageCache } from './api'

function formatRate(hit: number, total: number): string {
  if (!total || total <= 0) return '-'
  const r = (hit / total) * 100
  if (!Number.isFinite(r)) return '-'
  return `${r.toFixed(2)}%`
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  target: {
    rule_name: string
    using_group: string
    key_hint: string
    key_fp: string
  } | null
}

export function CacheStatsDialog(props: Props) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState<any>(null)
  const seqRef = useRef(0)

  useEffect(() => {
    if (!props.open || !props.target?.rule_name || !props.target?.key_fp) {
      setStats(null)
      return
    }

    const seq = ++seqRef.current
    setLoading(true)
    setStats(null)

    getAffinityUsageCache(props.target)
      .then((res) => {
        if (seq !== seqRef.current) return
        if (res.success) setStats(res.data || {})
        else toast.error(res.message || t('Request failed'))
      })
      .catch(() => {
        if (seq !== seqRef.current) return
        toast.error(t('Request failed'))
      })
      .finally(() => {
        if (seq !== seqRef.current) return
        setLoading(false)
      })
  }, [props.open, props.target, t])

  const rows = useMemo(() => {
    if (!stats) return []
    const s = stats
    const data: { key: string; value: string | number }[] = []
    const hit = Number(s.hit || 0)
    const total = Number(s.total || 0)

    if (s.rule_name || props.target?.rule_name)
      data.push({ key: t('Rule'), value: s.rule_name || props.target?.rule_name || '' })
    if (s.using_group || props.target?.using_group)
      data.push({ key: t('Group'), value: s.using_group || props.target?.using_group || '' })
    if (props.target?.key_hint)
      data.push({ key: t('Key Summary'), value: props.target.key_hint })
    if (s.key_fp || props.target?.key_fp)
      data.push({ key: t('Key Fingerprint'), value: s.key_fp || props.target?.key_fp || '' })
    if (Number(s.window_seconds || 0) > 0)
      data.push({ key: t('TTL (seconds)'), value: s.window_seconds })
    if (total > 0)
      data.push({ key: t('Hit Rate'), value: `${hit}/${total} (${formatRate(hit, total)})` })
    if (Number(s.last_seen_at || 0) > 0)
      data.push({ key: t('Last Seen'), value: formatTimestampToDate(s.last_seen_at) })

    const promptTokens = Number(s.prompt_tokens || 0)
    const cachedTokens = Number(s.cached_tokens || 0)
    const completionTokens = Number(s.completion_tokens || 0)
    const totalTokens = Number(s.total_tokens || 0)

    if (promptTokens > 0) data.push({ key: 'Prompt tokens', value: promptTokens })
    if (cachedTokens > 0) data.push({ key: 'Cached tokens', value: cachedTokens })
    if (completionTokens > 0) data.push({ key: 'Completion tokens', value: completionTokens })
    if (totalTokens > 0) data.push({ key: 'Total tokens', value: totalTokens })

    return data
  }, [stats, props.target, t])

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>{t('Channel Affinity: Upstream Cache Hit')}</DialogTitle>
        </DialogHeader>
        <p className='text-xs text-muted-foreground'>
          {t('Hit criteria: If cached tokens exist in usage, it counts as a hit.')}
        </p>
        {loading ? (
          <div className='py-8 text-center text-sm text-muted-foreground'>
            {t('Loading...')}
          </div>
        ) : rows.length > 0 ? (
          <div className='space-y-2'>
            {rows.map((row) => (
              <div
                key={row.key}
                className='flex justify-between text-sm border-b pb-1'
              >
                <span className='text-muted-foreground'>{row.key}</span>
                <span className='font-medium'>{row.value}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className='py-8 text-center text-sm text-muted-foreground'>
            {t('No data available')}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
