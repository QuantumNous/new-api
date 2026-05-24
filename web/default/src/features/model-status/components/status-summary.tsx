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
import type { ReactNode } from 'react'
import { Activity, Clock, Layers3, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatRelativeTime, healthDescription } from '../lib/format'
import type { ModelStatusViewSummary } from '../types'
import { StatusPill } from './status-pill'

export function StatusSummary(props: {
  summary: ModelStatusViewSummary
  refreshing: boolean
  onRefresh: () => void
}) {
  const unstableModels = props.summary.degradedModels + props.summary.downModels

  return (
    <section className='relative overflow-hidden rounded-3xl border bg-[radial-gradient(circle_at_20%_0%,oklch(0.78_0.16_145/.16),transparent_34%),linear-gradient(135deg,hsl(var(--card)),hsl(var(--card)))] px-5 py-6 shadow-sm sm:px-8 sm:py-8'>
      <div className='relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between'>
        <div className='max-w-2xl space-y-4'>
          <StatusPill health={props.summary.overallStatus} />
          <div>
            <h1 className='text-3xl font-bold tracking-tight sm:text-4xl'>
              模型状态
            </h1>
            <p className='text-muted-foreground mt-3 text-sm leading-6 sm:text-base'>
              {healthDescription(props.summary.overallStatus)}
              ，展示已接入状态同步的模型可用性，数据每 60 秒缓存更新。
            </p>
          </div>
        </div>

        <Button
          variant='outline'
          onClick={props.onRefresh}
          disabled={props.refreshing}
          className='w-fit'
        >
          {props.refreshing ? '刷新中' : '立即刷新'}
        </Button>
      </div>

      <div className='relative z-10 mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
        <SummaryMetric
          icon={<ShieldCheck className='size-4' />}
          label='正常模型'
          value={props.summary.upModels}
        />
        <SummaryMetric
          icon={<Activity className='size-4' />}
          label='异常 / 波动'
          value={unstableModels}
        />
        <SummaryMetric
          icon={<Layers3 className='size-4' />}
          label='接入分组'
          value={props.summary.totalGroups}
        />
        <SummaryMetric
          icon={<Clock className='size-4' />}
          label='最近更新'
          value={formatRelativeTime(props.summary.updatedAt)}
        />
      </div>
    </section>
  )
}

function SummaryMetric(props: {
  icon: ReactNode
  label: string
  value: ReactNode
}) {
  return (
    <div className='bg-background/70 rounded-2xl border px-4 py-3 backdrop-blur'>
      <div className='text-muted-foreground flex items-center gap-2 text-xs'>
        {props.icon}
        {props.label}
      </div>
      <div className='mt-2 text-xl font-semibold'>{props.value}</div>
    </div>
  )
}
