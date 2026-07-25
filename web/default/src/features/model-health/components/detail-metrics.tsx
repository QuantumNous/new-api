/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or (at your
option) any later version.
*/
import { useTranslation } from 'react-i18next'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatInteger, formatMetric, formatPercent } from '../lib'
import type { ModelHealthDetail } from '../types'
import { HealthBadge } from './health-badge'

export function DetailKpis(props: { detail: ModelHealthDetail }) {
  const { t } = useTranslation()
  const items = [
    {
      label: t('Final requests'),
      value: formatInteger(props.detail.model.request_count),
    },
    {
      label: t('Observed success'),
      value: t('{{value}}%', {
        value: formatPercent(props.detail.model.success_rate),
      }),
    },
    {
      label: t('Average duration'),
      value: t('{{value}} ms', {
        value: formatMetric(props.detail.model.avg_latency_ms),
      }),
    },
    {
      label: t('Average TTFT'),
      value:
        props.detail.model.avg_ttft_ms === null
          ? '—'
          : t('{{value}} ms', {
              value: formatMetric(props.detail.model.avg_ttft_ms),
            }),
    },
    { label: t('TPS'), value: formatMetric(props.detail.model.avg_tps, 2) },
  ]

  return (
    <dl className='grid grid-cols-2 overflow-hidden rounded-xl border sm:grid-cols-5'>
      {items.map((item) => (
        <div
          key={item.label}
          className='flex min-w-0 flex-col gap-1 border-b p-3 last:border-b-0 sm:border-r sm:border-b-0 sm:last:border-r-0'
        >
          <dt className='text-muted-foreground truncate text-xs'>
            {item.label}
          </dt>
          <dd className='font-mono text-base font-semibold tabular-nums'>
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export function GroupBreakdown(props: { detail: ModelHealthDetail }) {
  const { t } = useTranslation()
  return (
    <section className='overflow-hidden rounded-xl border'>
      <div className='border-b px-4 py-3'>
        <h3 className='text-sm font-semibold'>{t('Group breakdown')}</h3>
      </div>
      <Table className='min-w-[44rem]'>
        <TableHeader>
          <TableRow>
            <TableHead>{t('Group')}</TableHead>
            <TableHead>{t('Health status')}</TableHead>
            <TableHead>{t('Final requests')}</TableHead>
            <TableHead>{t('Observed success')}</TableHead>
            <TableHead>{t('Average duration')}</TableHead>
            <TableHead>{t('Average TTFT')}</TableHead>
            <TableHead>{t('TPS')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {props.detail.groups.map((group) => (
            <TableRow key={group.group}>
              <TableCell className='font-mono'>{group.group}</TableCell>
              <TableCell>
                <HealthBadge state={group.health} />
              </TableCell>
              <TableCell>{formatInteger(group.request_count)}</TableCell>
              <TableCell>
                {t('{{value}}%', { value: formatPercent(group.success_rate) })}
              </TableCell>
              <TableCell>
                {t('{{value}} ms', {
                  value: formatMetric(group.avg_latency_ms),
                })}
              </TableCell>
              <TableCell>
                {group.avg_ttft_ms === null
                  ? '—'
                  : t('{{value}} ms', {
                      value: formatMetric(group.avg_ttft_ms),
                    })}
              </TableCell>
              <TableCell>{formatMetric(group.avg_tps, 2)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  )
}
