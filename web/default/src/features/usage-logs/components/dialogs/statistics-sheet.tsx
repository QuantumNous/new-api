/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) by the user, there is NO WARRANTY.
For commercial licensing, please contact support@quantumnous.com
*/
import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { VChart } from '@visactor/react-vchart'
import { Download, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { formatLogQuota, formatNumber } from '@/lib/format'
import { VCHART_OPTION } from '@/lib/vchart'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ComboboxInput } from '@/components/ui/combobox-input'
import { StatisticsDateRangePicker } from '../statistics-date-range-picker'
import { useIsAdmin } from '@/hooks/use-admin'
import { useAuthStore } from '@/stores/auth-store'
import {
  getLogStatistics,
  exportLogStatistics,
  getStatisticsUserOptions,
  getStatisticsTokenOptions,
  getStatisticsModelOptions,
} from '../../api'
import type { ModelStatistics, TrendPoint } from '../../types'

function useDebouncedCallback<T extends (...args: unknown[]) => void>(
  callback: T,
  delay: number
): T {
  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  return useCallback(
    ((...args: unknown[]) => {
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => callback(...args), delay)
    }) as T,
    [callback, delay]
  )
}

interface StatisticsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function StatisticsSheet({ open, onOpenChange }: StatisticsSheetProps) {
  const { t } = useTranslation()
  const isAdmin = useIsAdmin()
  const currentUser = useAuthStore((state) => state.auth.user)

  const [username, setUsername] = useState('')
  const [tokenName, setTokenName] = useState('')
  const [modelName, setModelName] = useState('')
  const [startTime, setStartTime] = useState<Date | undefined>(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  })
  const [endTime, setEndTime] = useState<Date | undefined>(new Date())
  const [loading, setLoading] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)
  const [statistics, setStatistics] = useState<ModelStatistics[] | null>(null)
  const [trend, setTrend] = useState<TrendPoint[]>([])
  const [activeTab, setActiveTab] = useState<string>('count')

  // Combobox options
  const [userOptions, setUserOptions] = useState<
    { value: string; label: string }[]
  >([])
  const [tokenOptions, setTokenOptions] = useState<
    { value: string; label: string }[]
  >([])
  const [modelOptions, setModelOptions] = useState<
    { value: string; label: string }[]
  >([])

  // Stable ref to latest username for cascade queries
  const usernameRef = useRef(username)

  // Auto-fill username for non-admin users
  useEffect(() => {
    if (!isAdmin && currentUser?.username) {
      setUsername(currentUser.username)
      usernameRef.current = currentUser.username
    }
  }, [isAdmin, currentUser?.username])

  // Load initial user options when sheet opens (admin only)
  useEffect(() => {
    if (open && isAdmin) {
      getStatisticsUserOptions('')
        .then((names) =>
          setUserOptions(names.map((n) => ({ value: n, label: n })))
        )
        .catch(() => {})
    }
  }, [open, isAdmin])

  // Debounced user search (admin only)
  const debouncedUserSearch = useDebouncedCallback(
    useCallback(
      async (search: string) => {
        if (!isAdmin) return
        try {
          const names = await getStatisticsUserOptions(search)
          setUserOptions(names.map((n) => ({ value: n, label: n })))
        } catch {
          // silently fail
        }
      },
      [isAdmin]
    ),
    300
  )

  // Load token options when username changes (debounced)
  useEffect(() => {
    if (!username) {
      setTokenOptions([])
      return
    }
    const timer = setTimeout(() => {
      getStatisticsTokenOptions(username)
        .then((res) =>
          setTokenOptions(res.data.map((t) => ({ value: t.name, label: t.name })))
        )
        .catch(() => setTokenOptions([]))
    }, 300)
    return () => clearTimeout(timer)
  }, [username])

  // Load model options when token changes (debounced)
  useEffect(() => {
    if (!username) {
      setModelOptions([])
      return
    }
    const timer = setTimeout(() => {
      getStatisticsModelOptions(username, tokenName || undefined)
        .then((names) =>
          setModelOptions(names.map((n) => ({ value: n, label: n })))
        )
        .catch(() => setModelOptions([]))
    }, 300)
    return () => clearTimeout(timer)
  }, [username, tokenName])

  const buildParams = useCallback(() => {
    if (!username.trim()) return null
    const params: Record<string, string> = {
      username: username.trim(),
    }
    if (tokenName.trim()) params.token_name = tokenName.trim()
    if (modelName.trim()) params.model_name = modelName.trim()
    if (startTime) {
      params.start_timestamp = String(
        Math.floor(new Date(startTime).getTime() / 1000)
      )
    }
    if (endTime) {
      params.end_timestamp = String(
        Math.floor(new Date(endTime).getTime() / 1000)
      )
    }
    return params
  }, [username, tokenName, modelName, startTime, endTime])

  const handleFetch = useCallback(async () => {
    const params = buildParams()
    if (!params) {
      toast.error(t('Username is required'))
      return
    }
    setLoading(true)
    try {
      const res = await getLogStatistics(params)
      if (res.success) {
        setStatistics(res.data?.models ?? [])
        setTrend(res.data?.trend ?? [])
      } else {
        toast.error(res.message || t('Failed to fetch statistics'))
      }
    } catch {
      toast.error(t('Failed to fetch statistics'))
    } finally {
      setLoading(false)
    }
  }, [buildParams, t])

  const handleExport = useCallback(async () => {
    const params = buildParams()
    if (!params) return
    setExportLoading(true)
    try {
      await exportLogStatistics(params)
    } catch {
      toast.error(t('Export failed'))
    } finally {
      setExportLoading(false)
    }
  }, [buildParams, t])

  const fmtTokenM = useCallback((v: number) => {
    const m = v / 1_000_000
    if (m === 0) return '0'
    if (m >= 100) return m.toFixed(1)
    if (m >= 1) return m.toFixed(2)
    if (m >= 0.01) return m.toFixed(4)
    return m.toFixed(6)
  }, [])

  const hasData = statistics !== null && statistics.length > 0

  const summaryData = useMemo(() => {
    if (!hasData) return []
    return [
      {
        model_name: t('Total'),
        request_count: statistics!.reduce(
          (s, m) => s + (m.request_count || 0),
          0
        ),
        quota: statistics!.reduce((s, m) => s + (m.quota || 0), 0),
        prompt_tokens: statistics!.reduce(
          (s, m) => s + (m.prompt_tokens || 0),
          0
        ),
        completion_tokens: statistics!.reduce(
          (s, m) => s + (m.completion_tokens || 0),
          0
        ),
      },
    ]
  }, [statistics, hasData, t])

  const barSpec = useMemo(() => {
    if (!hasData) return null
    return {
      type: 'bar',
      data: [
        {
          id: 'barData',
          values: statistics!.map((m) => ({
            Model: m.model_name,
            Count: m.request_count,
          })),
        },
      ],
      xField: 'Model',
      yField: 'Count',
      seriesField: 'Model',
      legends: { visible: true, selectMode: 'single' },
      title: {
        visible: true,
        text: t('Request Count Distribution'),
        subtext: `${t('Total')}: ${formatNumber(statistics!.reduce((s, m) => s + m.request_count, 0))}`,
      },
      bar: { state: { hover: { stroke: '#000', lineWidth: 1 } } },
      tooltip: {
        mark: {
          content: [
            {
              key: (d: Record<string, unknown>) => d['Model'] as string,
              value: (d: Record<string, unknown>) =>
                formatNumber(d['Count'] as number),
            },
          ],
        },
      },
    }
  }, [statistics, hasData, t])

  const quotaBarSpec = useMemo(() => {
    if (!hasData) return null
    return {
      type: 'bar',
      data: [
        {
          id: 'quotaData',
          values: statistics!.map((m) => ({
            Model: m.model_name,
            Usage: formatLogQuota(m.quota),
          })),
        },
      ],
      xField: 'Model',
      yField: 'Usage',
      seriesField: 'Model',
      stack: false,
      legends: { visible: true, selectMode: 'single' },
      title: {
        visible: true,
        text: t('Quota Distribution'),
        subtext: `${t('Total')}: ${formatLogQuota(statistics!.reduce((s, m) => s + m.quota, 0))}`,
      },
      bar: { state: { hover: { stroke: '#000', lineWidth: 1 } } },
      tooltip: {
        mark: {
          content: [
            {
              key: (d: Record<string, unknown>) => d['Model'] as string,
              value: (d: Record<string, unknown>) =>
                formatLogQuota(d['rawQuota'] as number),
            },
          ],
        },
      },
    }
  }, [statistics, hasData, t])

  const trendSpec = useMemo(() => {
    if (!trend || trend.length === 0) return null
    return {
      type: 'line',
      data: [
        {
          id: 'trendData',
          values: trend.map((tp) => ({
            Time: tp.time,
            Model: tp.model_name,
            Count: tp.request_count,
          })),
        },
      ],
      xField: 'Time',
      yField: 'Count',
      seriesField: 'Model',
      legends: { visible: true, selectMode: 'single' },
      title: {
        visible: true,
        text: t('Call Trend'),
      },
      tooltip: {
        mark: {
          content: [
            {
              key: (d: Record<string, unknown>) => d['Model'] as string,
              value: (d: Record<string, unknown>) =>
                formatNumber(d['Count'] as number),
            },
          ],
        },
      },
    }
  }, [trend, t])

  const currentSpec =
    activeTab === 'count'
      ? barSpec
      : activeTab === 'quota'
        ? quotaBarSpec
        : trendSpec

  const inputClass = 'w-full'

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side='right'
        className='sm:max-w-2xl overflow-auto'
        showCloseButton
      >
        <SheetHeader>
          <SheetTitle>{t('Usage Statistics')}</SheetTitle>
        </SheetHeader>

        <div className='space-y-4 px-4 pb-6'>
          {/* Form */}
          <div className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
            <ComboboxInput
              options={userOptions}
              value={username}
              onValueChange={(val) => {
                setUsername(val)
                usernameRef.current = val
                setTokenName('')
                setModelName('')
                if (isAdmin) {
                  debouncedUserSearch(val)
                }
              }}
              placeholder={t('Username (required)')}
              allowCustomValue
              className={inputClass}
              disabled={!isAdmin}
            />
            <ComboboxInput
              options={tokenOptions}
              value={tokenName}
              onValueChange={(val) => {
                setTokenName(val)
                setModelName('')
              }}
              placeholder={t('Token Name (optional)')}
              allowCustomValue
              className={inputClass}
            />
            <ComboboxInput
              options={modelOptions}
              value={modelName}
              onValueChange={setModelName}
              placeholder={t('Model Name (optional)')}
              allowCustomValue
              className={inputClass}
            />
            <StatisticsDateRangePicker
              start={startTime}
              end={endTime}
              onChange={({ start, end }) => {
                setStartTime(start)
                setEndTime(end)
              }}
              className={inputClass}
            />
          </div>

          <div className='flex gap-2'>
            <Button size='sm' onClick={handleFetch} disabled={loading}>
              <Search className='mr-1 size-4' />
              {t('Query')}
            </Button>
            {hasData && (
              <Button
                size='sm'
                variant='outline'
                onClick={handleExport}
                disabled={exportLoading}
              >
                <Download className='mr-1 size-4' />
                {t('Export Excel')}
              </Button>
            )}
          </div>

          {/* Charts */}
          {hasData && (
            <div className='space-y-3'>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className='h-auto flex-wrap justify-start'>
                  <TabsTrigger value='count'>
                    {t('Request Count Distribution')}
                  </TabsTrigger>
                  <TabsTrigger value='quota'>
                    {t('Quota Distribution')}
                  </TabsTrigger>
                  <TabsTrigger value='trend'>{t('Call Trend')}</TabsTrigger>
                </TabsList>
              </Tabs>

              <div className='h-80'>
                {currentSpec && (
                  <VChart
                    spec={{ ...currentSpec, background: 'transparent' }}
                    option={VCHART_OPTION}
                  />
                )}
                {!currentSpec && (
                  <div className='flex h-full items-center justify-center text-muted-foreground'>
                    {t('No Data')}
                  </div>
                )}
              </div>
            </div>
          )}

          {statistics !== null && statistics.length === 0 && (
            <div className='flex h-40 items-center justify-center text-muted-foreground'>
              {t('No Data')}
            </div>
          )}

          {/* Summary table */}
          {hasData && (
            <div className='space-y-2'>
              <h4 className='text-sm font-medium'>{t('Summary')}</h4>
              <div className='overflow-auto rounded-md border'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('Model Name')}</TableHead>
                      <TableHead className='text-right'>
                        {t('Request Count')}
                      </TableHead>
                      <TableHead className='text-right'>
                        {t('Consumed Quota')}
                      </TableHead>
                      <TableHead className='text-right'>
                        Prompt Tokens(M)
                      </TableHead>
                      <TableHead className='text-right'>
                        Completion Tokens(M)
                      </TableHead>
                      <TableHead className='text-right'>
                        {t('Total Tokens')}(M)
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {statistics!.map((m) => (
                      <TableRow key={m.model_name}>
                        <TableCell className='font-medium'>
                          {m.model_name}
                        </TableCell>
                        <TableCell className='text-right'>
                          {formatNumber(m.request_count)}
                        </TableCell>
                        <TableCell className='text-right'>
                          {formatLogQuota(m.quota)}
                        </TableCell>
                        <TableCell className='text-right'>
                          {fmtTokenM(m.prompt_tokens || 0)}
                        </TableCell>
                        <TableCell className='text-right'>
                          {fmtTokenM(m.completion_tokens || 0)}
                        </TableCell>
                        <TableCell className='text-right'>
                          {fmtTokenM(
                            (m.prompt_tokens || 0) +
                              (m.completion_tokens || 0)
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {summaryData.map((s) => (
                      <TableRow key='__summary__' className='bg-muted/50 font-medium'>
                        <TableCell>{s.model_name}</TableCell>
                        <TableCell className='text-right'>
                          {formatNumber(s.request_count)}
                        </TableCell>
                        <TableCell className='text-right'>
                          {formatLogQuota(s.quota)}
                        </TableCell>
                        <TableCell className='text-right'>
                          {fmtTokenM(s.prompt_tokens)}
                        </TableCell>
                        <TableCell className='text-right'>
                          {fmtTokenM(s.completion_tokens)}
                        </TableCell>
                        <TableCell className='text-right'>
                          {fmtTokenM(s.prompt_tokens + s.completion_tokens)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
