import { useEffect, useMemo, useState } from 'react'
import { BarChart3 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth-store'
import { formatNumber, formatQuota } from '@/lib/format'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ADMIN_ANALYSIS_DIMENSIONS,
  ANALYSIS_FALLBACK_DIMENSIONS,
  getLogUsageAnalysis,
  USER_ANALYSIS_DIMENSIONS,
} from '@/features/dashboard/api'
import type {
  DashboardFilters,
  LogUsageAnalysisResponse,
} from '@/features/dashboard/types'

const CST_FORMATTER = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

function formatCstPeriod(period: number): string {
  if (!period) return '-'
  return CST_FORMATTER.format(new Date(period * 1000))
}

interface MultidimensionalAnalysisProps {
  filters?: DashboardFilters
}

interface AnalysisRequestResult {
  success: boolean
  data?: LogUsageAnalysisResponse
  code?: string
  message?: string
}

export function MultidimensionalAnalysis({
  filters,
}: MultidimensionalAnalysisProps) {
  const { t } = useTranslation()
  const user = useAuthStore((state) => state.auth.user)
  const isAdmin = Boolean(user?.role && user.role >= 10)
  const [analysis, setAnalysis] = useState<LogUsageAnalysisResponse | null>(
    null
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [notice, setNotice] = useState('')
  const defaultDimensions = isAdmin
    ? ADMIN_ANALYSIS_DIMENSIONS
    : USER_ANALYSIS_DIMENSIONS

  useEffect(() => {
    const abortController = new AbortController()
    let active = true
    setLoading(true)
    setError(false)
    setNotice('')
    setAnalysis(null)

    const loadAnalysis = async () => {
      const request = async (
        dimensions: readonly string[]
      ): Promise<AnalysisRequestResult> => {
        try {
          return await getLogUsageAnalysis(
            filters,
            isAdmin,
            dimensions,
            abortController.signal
          )
        } catch (requestError) {
          const payload = (
            requestError as { response?: { data?: Record<string, string> } }
          )?.response?.data
          return {
            success: false,
            code: payload?.code,
            message: payload?.message || 'Analysis unavailable',
          }
        }
      }

      const primary = await request(defaultDimensions)
      if (!active || abortController.signal.aborted) return
      if (primary.success && primary.data) {
        setAnalysis(primary.data)
        return
      }

      const primaryError = primary as { code?: string; message?: string }
      if (
        primaryError.code === 'analysis_too_many_rows' ||
        primaryError.message?.includes('超过 5000')
      ) {
        const fallback = await request(ANALYSIS_FALLBACK_DIMENSIONS)
        if (!active || abortController.signal.aborted) return
        if (fallback.success && fallback.data) {
          setAnalysis(fallback.data)
          setNotice(
            '结果超过 5000 个分组，已自动降级为仅按时间分组；如需明细，请缩小筛选范围或降低时间粒度。'
          )
          return
        }
      }

      setAnalysis(null)
      setError(true)
    }

    loadAnalysis()
      .catch(() => {
        if (!active || abortController.signal.aborted) return
        setAnalysis(null)
        setError(true)
      })
      .finally(() => {
        if (active && !abortController.signal.aborted) setLoading(false)
      })
    return () => {
      active = false
      abortController.abort()
    }
  }, [filters, isAdmin])

  const rows = analysis?.rows ?? []
  const totals = useMemo(
    () =>
      rows.reduce(
        (result, row) => {
          result.quota += Number(row.quota || 0)
          result.requests += Number(row.request_count || 0)
          result.tokens +=
            Number(row.prompt_tokens || 0) + Number(row.completion_tokens || 0)
          return result
        },
        { quota: 0, requests: 0, tokens: 0 }
      ),
    [rows]
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2 text-base'>
          <BarChart3 className='size-4' />
          <span>
            {isAdmin
              ? t('Multidimensional Usage Analysis')
              : t('Usage Analysis')}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className='space-y-3'>
        {loading ? (
          <Skeleton className='h-28 w-full' />
        ) : error ? (
          <p className='text-muted-foreground text-sm'>
            {t('Analysis unavailable')}
          </p>
        ) : rows.length === 0 ? (
          <p className='text-muted-foreground text-sm'>
            {t('No consumption records in this range')}
          </p>
        ) : (
          <>
            <div className='grid grid-cols-3 gap-2 text-sm'>
              <div className='bg-muted/50 rounded-md p-2'>
                <div className='text-muted-foreground text-xs'>
                  {t('Consumption')}
                </div>
                <div className='font-medium'>{formatQuota(totals.quota)}</div>
              </div>
              <div className='bg-muted/50 rounded-md p-2'>
                <div className='text-muted-foreground text-xs'>
                  {t('Requests')}
                </div>
                <div className='font-medium'>
                  {formatNumber(totals.requests)}
                </div>
              </div>
              <div className='bg-muted/50 rounded-md p-2'>
                <div className='text-muted-foreground text-xs'>
                  {t('Tokens')}
                </div>
                <div className='font-medium'>{formatNumber(totals.tokens)}</div>
              </div>
            </div>
            <div className='overflow-x-auto rounded-md border'>
              <table className='w-full text-left text-xs'>
                <thead className='bg-muted/50 text-muted-foreground'>
                  <tr>
                    <th className='px-3 py-2'>{t('Time (Asia/Shanghai)')}</th>
                    {isAdmin && <th className='px-3 py-2'>{t('User')}</th>}
                    <th className='px-3 py-2'>{t('Model')}</th>
                    <th className='px-3 py-2 text-right'>{t('Requests')}</th>
                    <th className='px-3 py-2 text-right'>{t('Consumption')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 50).map((row, index) => (
                    <tr
                      key={`${row.period}-${row.model_name}-${index}`}
                      className='border-t'
                    >
                      <td className='px-3 py-2 whitespace-nowrap'>
                        {formatCstPeriod(row.period)}
                      </td>
                      {isAdmin && (
                        <td className='px-3 py-2'>{row.username || '-'}</td>
                      )}
                      <td className='px-3 py-2'>{row.model_name || '-'}</td>
                      <td className='px-3 py-2 text-right'>
                        {formatNumber(Number(row.request_count || 0))}
                      </td>
                      <td className='px-3 py-2 text-right'>
                        {formatQuota(Number(row.quota || 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {analysis?.cost_basis_note && isAdmin && (
              <p className='text-muted-foreground text-xs'>
                {analysis.cost_basis_note}
              </p>
            )}
            {notice && (
              <p className='text-muted-foreground text-xs'>{notice}</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
