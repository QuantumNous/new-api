/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Main } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import { getSchedulerMonitor, type SchedulerMonitor } from '../api'

function Value({
  label,
  value,
}: {
  label: string
  value: string | number | boolean | undefined
}) {
  return (
    <div className='rounded-lg border p-3'>
      <div className='text-muted-foreground text-xs'>{label}</div>
      <div className='mt-1 text-lg font-medium'>{value ?? '-'}</div>
    </div>
  )
}

function formatScore(score: number | undefined) {
  return score === undefined ? '-' : score.toFixed(3)
}

function formatLoad(load: number | undefined) {
  return load === undefined ? '-' : `${(load * 100).toFixed(1)}%`
}

function formatCapacity(
  used: number | undefined,
  capacity: number | undefined
) {
  if (!capacity || capacity <= 0) {
    return used === undefined ? '∞' : `${used} / ∞`
  }
  return `${used ?? 0} / ${capacity}`
}

export function SchedulerMonitorPage() {
  const { t } = useTranslation()
  const [monitor, setMonitor] = useState<SchedulerMonitor | null>(null)
  const [model, setModel] = useState('')
  const [channel, setChannel] = useState('')
  const [endpoint, setEndpoint] = useState('')
  const load = useCallback(
    () =>
      void getSchedulerMonitor({ model, channel_id: channel, endpoint_id: endpoint })
        .then((response) => setMonitor(response.data))
        .catch(() => toast.error(t('Failed to load scheduler monitor'))),
    [channel, endpoint, model, t]
  )
  useEffect(() => {
    load()
    const timer = window.setInterval(load, 10000)
    return () => window.clearInterval(timer)
  }, [load])
  const o = monitor?.observability
  const endpoints = o?.endpoints ?? []
  const profileNames = [
    ...new Set(
      endpoints.flatMap((endpoint) => Object.keys(endpoint.profiles ?? {}))
    ),
  ].sort()
  return (
    <Main>
      <div className='mx-auto w-full max-w-6xl space-y-4 p-4 sm:p-6'>
        <div className='flex items-center justify-between'>
          <div>
            <h1 className='text-2xl font-semibold'>
              {t('Scheduling Monitor')}
            </h1>
            <p className='text-muted-foreground'>
              {t('Live status from the Scheduler service.')}
            </p>
          </div>
          <Button variant='outline' onClick={load}>
            {t('Refresh')}
          </Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{t('Service status')}</CardTitle>
          </CardHeader>
          <CardContent className='grid gap-3 sm:grid-cols-4'>
            <Value
              label={t('Configured')}
              value={monitor?.configured ? t('Yes') : t('No')}
            />
            <Value
              label={t('Reachable')}
              value={monitor?.reachable ? t('Yes') : t('No')}
            />
            <Value
              label={t('Scheduler status')}
              value={
                o?.status === 'healthy_idle' ? t('Healthy (idle)') : o?.status
              }
            />
            <Value
              label={t('Checked at')}
              value={
                monitor?.checked_at
                  ? new Date(monitor.checked_at).toLocaleString()
                  : undefined
              }
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('Endpoint details')}</CardTitle>
          </CardHeader>
          <CardContent>
            <details className='mb-4 text-sm'>
              <summary className='cursor-pointer font-medium'>
                {t('健康状态说明')}
              </summary>
              <dl className='mt-3 grid gap-x-4 gap-y-2 sm:grid-cols-[auto_1fr]'>
                <dt className='font-mono'>AVAILABLE</dt>
                <dd>{t('可用：健康门禁允许调度，但仍需满足启用状态、权限、容量和评分等条件；不代表评分高或已有样本。')}</dd>
                <dt className='font-mono'>DEGRADED</dt>
                <dd>{t('降级：发生计入健康的失败。自动退避首次为 10 秒，第二次为 1 分钟；冷却期间暂停调度。')}</dd>
                <dt className='font-mono'>ERROR</dt>
                <dd>{t('异常：连续至少 3 次计入健康的失败，自动冷却 5 分钟，期间暂停调度。')}</dd>
                <dt className='font-mono'>RECOVERING</dt>
                <dd>{t('恢复中：降级或异常的冷却结束，在下次调度准入检查时允许重试；成功后恢复可用，失败则重新退避。')}</dd>
                <dt className='font-mono'>EXHAUSTED</dt>
                <dd>{t('耗尽：被标记为资源或额度耗尽，暂停调度；不会仅因冷却到期而自动恢复。')}</dd>
                <dt className='font-mono'>DISABLED_AUTO</dt>
                <dd>{t('自动禁用：被标记为自动停用，暂停调度；不会仅因冷却到期而自动恢复。')}</dd>
                <dt className='font-mono'>DISABLED_MANUAL</dt>
                <dd>{t('手动禁用：由管理员停用，暂停调度；成功请求也不会自动解除，需要显式更新状态。')}</dd>
              </dl>
              <p className='text-muted-foreground mt-3'>
                {t('健康状态按渠道和 Key 共享，适用于该端点下的各模型。429 会计入健康失败，其他 4xx 请求错误不计入。暂无运行时样本表示负载数据未知，不等于渠道故障。')}
              </p>
            </details>
            <div className='mb-4 flex flex-wrap gap-2'>
              <input className='rounded-md border px-3 py-2 text-sm' placeholder={t('Model')} value={model} onChange={(e) => setModel(e.target.value)} />
              <input className='rounded-md border px-3 py-2 text-sm' placeholder={t('Channel ID')} value={channel} onChange={(e) => setChannel(e.target.value)} />
              <input className='rounded-md border px-3 py-2 text-sm' placeholder={t('Endpoint')} value={endpoint} onChange={(e) => setEndpoint(e.target.value)} />
            </div>
            {endpoints.length === 0 ? (
              <p className='text-muted-foreground text-sm'>
                {t('No endpoint data')}
              </p>
            ) : (
              <div className='-mx-2 overflow-x-auto px-2'>
                <table className='w-full min-w-[980px] text-sm'>
                  <thead>
                    <tr className='text-muted-foreground border-b text-left'>
                      <th className='px-2 py-2'>{t('Endpoint')}</th>
                      <th className='px-2 py-2'>{t('Model')}</th>
                      <th className='px-2 py-2'>{t('Health')}</th>
                      <th className='px-2 py-2'>{t('Load')}</th>
                      <th className='px-2 py-2'>{t('RPM')}</th>
                      <th className='px-2 py-2'>{t('TPM')}</th>
                      {profileNames.map((profile) => (
                        <th className='px-2 py-2' key={profile}>
                          {profile}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {endpoints.map((endpoint) => (
                      <tr
                        className='border-b last:border-0'
                        key={endpoint.endpoint_id}
                      >
                        <td className='px-2 py-3'>
                          <div className='font-medium'>
                            {endpoint.endpoint_id}
                          </div>
                          <div className='text-muted-foreground text-xs'>
                            channel {endpoint.channel_id} / key{' '}
                            {endpoint.key_index}
                          </div>
                        </td>
                        <td className='px-2 py-3'>
                          <div>{endpoint.model ?? '-'}</div>
                          <div className='text-muted-foreground text-xs'>
                            {endpoint.provider ?? '-'}
                          </div>
                        </td>
                        <td className='px-2 py-3'>
                          {endpoint.health ?? '-'}
                          {!endpoint.runtime_known && (
                            <div className='text-muted-foreground text-xs'>
                              {t('Idle / no runtime sample')}
                            </div>
                          )}
                        </td>
                        <td className='px-2 py-3'>
                          {formatLoad(endpoint.load_ratio)}
                        </td>
                        <td className='px-2 py-3'>
                          {formatCapacity(
                            endpoint.rpm_used,
                            endpoint.rpm_capacity
                          )}
                        </td>
                        <td className='px-2 py-3'>
                          {formatCapacity(
                            endpoint.tpm_used,
                            endpoint.tpm_capacity
                          )}
                        </td>
                        {profileNames.map((profile) => {
                          const score = endpoint.profiles?.[profile]
                          return (
                            <td className='px-2 py-3' key={profile}>
                              <div>{formatScore(score?.score)}</div>
                              <div className='text-muted-foreground text-xs'>
                                tier {score?.gate_tier ?? '-'}
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Main>
  )
}
