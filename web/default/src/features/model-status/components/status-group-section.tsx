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
import { useTranslation } from 'react-i18next'
import { formatLatency, formatPercent, formatRelativeTime } from '../lib/format'
import type { ModelStatusViewGroup, ModelStatusViewModel } from '../types'
import { StatusPill } from './status-pill'
import { StatusTimeline } from './status-timeline'

export function StatusGroupSection(props: { group: ModelStatusViewGroup }) {
  const { t } = useTranslation()

  return (
    <section className='bg-card flex min-h-[340px] max-h-[620px] flex-col overflow-hidden rounded-2xl border shadow-sm'>
      <header className='bg-card/95 shrink-0 border-b px-4 py-3 backdrop-blur sm:px-5'>
        <div className='flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between'>
          <div>
            <h2 className='text-lg font-semibold tracking-tight'>
              {props.group.name}
            </h2>
            <p className='text-muted-foreground mt-1 text-sm'>
              {t('{{count}} models', { count: props.group.totalModels })} ·{' '}
              {t('Updated')} {formatRelativeTime(props.group.updatedAt, t)}
            </p>
          </div>
          <p className='text-muted-foreground text-sm'>
            {t('Current')} {props.group.upModels} {t('Healthy').toLowerCase()}
            {props.group.degradedModels > 0 &&
              ` / ${props.group.degradedModels} ${t('Degraded').toLowerCase()}`}
            {props.group.downModels > 0 &&
              ` / ${props.group.downModels} ${t('Unavailable').toLowerCase()}`}
          </p>
        </div>
      </header>

      <div className='min-h-0 flex-1 divide-y overflow-y-auto'>
        {props.group.models.map((model) => (
          <ModelStatusRow
            key={`${model.group}-${model.model}`}
            model={model}
            t={t}
          />
        ))}
      </div>
    </section>
  )
}

function ModelStatusRow(props: {
  model: ModelStatusViewModel
  t: (key: string, options?: Record<string, unknown>) => string
}) {
  return (
    <article className='grid gap-3 px-4 py-3 transition-colors hover:bg-muted/30 sm:px-5 md:grid-cols-[minmax(160px,1fr)_76px_76px] md:items-center 2xl:grid-cols-[minmax(150px,1fr)_70px_70px]'>
      <div className='min-w-0'>
        <div className='flex flex-wrap items-center gap-2'>
          <h3 className='truncate text-sm font-semibold'>
            {props.model.model}
          </h3>
          <StatusPill health={props.model.healthLabel} t={props.t} />
        </div>
        <p className='text-muted-foreground mt-1 text-xs'>
          {props.t('Updated')} {formatRelativeTime(props.model.updatedAt, props.t)}
        </p>
      </div>

      <Metric label={props.t('Availability')} value={formatPercent(props.model.uptime)} />
      <Metric label={props.t('Latency')} value={formatLatency(props.model.latency)} />
      <div className='min-w-0 md:col-span-3'>
        <StatusTimeline history={props.model.history} t={props.t} />
      </div>
    </article>
  )
}

function Metric(props: { label: string; value: string }) {
  return (
    <div>
      <div className='text-muted-foreground text-xs'>{props.label}</div>
      <div className='mt-1 text-sm font-semibold'>{props.value}</div>
    </div>
  )
}
