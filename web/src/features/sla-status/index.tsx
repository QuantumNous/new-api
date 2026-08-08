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
*/
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { StatusBadge } from '@/components/status-badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatTimestampToDate } from '@/lib/format'

import {
  getPublicSlaIncidents,
  getPublicSlaStatus,
} from '@/features/sla-incidents/api'
import {
  SLA_INCIDENT_SEVERITY_CONFIG,
  SLA_INCIDENT_STATUS_CONFIG,
} from '@/features/sla-incidents/constants'
import type { SlaIncident } from '@/features/sla-incidents/types'

const WINDOW_OPTIONS = [
  { value: '24', label: 'Last 24 hours' },
  { value: '48', label: 'Last 48 hours' },
  { value: '168', label: 'Last 7 days' },
  { value: '720', label: 'Last 30 days' },
]

export function SlaStatusPage() {
  const { t } = useTranslation()
  const [windowHours, setWindowHours] = useState('24')

  const { data: statusData, isLoading: isStatusLoading } = useQuery({
    queryKey: ['public-sla-status', windowHours],
    queryFn: async () => {
      const result = await getPublicSlaStatus(Number(windowHours))
      return result.data ?? null
    },
  })

  const { data: incidentsData, isLoading: isIncidentsLoading } = useQuery({
    queryKey: ['public-sla-incidents'],
    queryFn: async () => {
      const result = await getPublicSlaIncidents()
      return result.data?.items ?? []
    },
  })

  const availabilityPercent = useMemo(() => {
    if (!statusData) return '—'
    return `${(statusData.availability * 100).toFixed(2)}%`
  }, [statusData])

  return (
    <div className='mx-auto max-w-5xl space-y-6 p-4 sm:p-6'>
      <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <h1 className='text-2xl font-semibold'>{t('Service Status')}</h1>
          <p className='text-muted-foreground text-sm'>
            {t('Current service availability and incident history')}
          </p>
        </div>
        <div className='w-44'>
          <Select
            items={WINDOW_OPTIONS}
            onValueChange={(v) => setWindowHours(String(v))}
            value={windowHours}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectGroup>
                {WINDOW_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {t(opt.label)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className='grid grid-cols-2 gap-4 sm:grid-cols-4'>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium'>
              {t('Availability')}
            </CardTitle>
          </CardHeader>
          <CardContent className='text-2xl font-semibold'>
            {isStatusLoading ? '…' : availabilityPercent}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium'>
              {t('Active Incidents')}
            </CardTitle>
          </CardHeader>
          <CardContent className='text-2xl font-semibold'>
            {isStatusLoading ? '…' : statusData?.active_incidents ?? 0}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium'>
              {t('Nodes')}
            </CardTitle>
          </CardHeader>
          <CardContent className='text-2xl font-semibold'>
            {isStatusLoading
              ? '…'
              : `${statusData?.ok_node_count ?? 0}/${statusData?.node_count ?? 0}`}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium'>
              {t('Window')}
            </CardTitle>
          </CardHeader>
          <CardContent className='text-2xl font-semibold'>
            {statusData?.window_hours ?? windowHours}h
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('Recent Incidents')}</CardTitle>
        </CardHeader>
        <CardContent>
          {isIncidentsLoading ? (
            <div className='text-muted-foreground text-sm'>
              {t('Loading...')}
            </div>
          ) : (
            <SlaIncidentList incidents={incidentsData ?? []} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function SlaIncidentList({ incidents }: { incidents: SlaIncident[] }) {
  const { t } = useTranslation()

  if (incidents.length === 0) {
    return (
      <div className='text-muted-foreground text-sm'>
        {t('No incidents reported')}
      </div>
    )
  }

  return (
    <ul className='divide-border divide-y'>
      {incidents.map((incident) => {
        const statusConfig = SLA_INCIDENT_STATUS_CONFIG[incident.status]
        const severityConfig = SLA_INCIDENT_SEVERITY_CONFIG[incident.severity]
        return (
          <li
            key={incident.id}
            className='flex flex-wrap items-center justify-between gap-2 py-3'
          >
            <div className='min-w-0'>
              <div className='truncate font-medium'>{incident.title}</div>
              <div className='text-muted-foreground text-xs'>
                {incident.started_at > 0
                  ? formatTimestampToDate(incident.started_at)
                  : ''}
              </div>
            </div>
            <div className='flex items-center gap-2'>
              {severityConfig && (
                <StatusBadge
                  label={t(severityConfig.labelKey)}
                  variant={severityConfig.variant}
                  copyable={false}
                />
              )}
              {statusConfig && (
                <StatusBadge
                  label={t(statusConfig.labelKey)}
                  variant={statusConfig.variant}
                  copyable={false}
                />
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
