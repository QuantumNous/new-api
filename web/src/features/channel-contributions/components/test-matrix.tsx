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
import {
  CheckCircle2,
  CircleDashed,
  Clock3,
  Loader2,
  XCircle,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { StatusBadge } from '@/components/status-badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import {
  getProbeError,
  getProbeResponseTime,
  getTestRunResults,
  isTestRunActive,
  probePassed,
} from '../lib'
import type {
  ChannelContributionProbeResult,
  ChannelContributionTestRun,
} from '../types'
import { ContributionTestRunStatusBadge } from './contribution-status'

function ProbeCell(props: {
  probe?: ChannelContributionProbeResult | null
  pending: boolean
  required?: boolean
}) {
  const { t } = useTranslation()

  if (props.required === false) {
    return (
      <StatusBadge
        label={t('Not required')}
        variant='neutral'
        copyable={false}
      />
    )
  }

  if (!props.probe) {
    return props.pending ? (
      <span className='text-muted-foreground inline-flex items-center gap-1.5'>
        <Loader2 className='size-3.5 animate-spin' aria-hidden='true' />
        {t('Waiting')}
      </span>
    ) : (
      <span className='text-muted-foreground inline-flex items-center gap-1.5'>
        <CircleDashed className='size-3.5' aria-hidden='true' />
        {t('Not tested')}
      </span>
    )
  }

  const passed = probePassed(props.probe)
  const responseTime = getProbeResponseTime(props.probe)
  const error = getProbeError(props.probe)
  return (
    <div className='flex min-w-28 flex-col gap-0.5' title={error || undefined}>
      <span
        className={
          passed
            ? 'text-success inline-flex items-center gap-1.5'
            : 'text-destructive inline-flex items-center gap-1.5'
        }
      >
        {passed ? (
          <CheckCircle2 className='size-3.5' aria-hidden='true' />
        ) : (
          <XCircle className='size-3.5' aria-hidden='true' />
        )}
        {passed ? t('Passed') : t('Failed')}
      </span>
      {responseTime != null ? (
        <span className='text-muted-foreground text-xs'>
          {t('{{milliseconds}} ms', { milliseconds: responseTime })}
        </span>
      ) : null}
      {!passed && error ? (
        <span className='text-muted-foreground max-w-52 truncate text-xs'>
          {error}
        </span>
      ) : null}
    </div>
  )
}

export function ContributionTestMatrix(props: {
  run: ChannelContributionTestRun | null
}) {
  const { t } = useTranslation()
  const results = getTestRunResults(props.run)
  const pending = isTestRunActive(props.run)

  if (!props.run) {
    return (
      <div className='text-muted-foreground flex min-h-28 items-center justify-center border-y py-6 text-center text-sm'>
        <div className='space-y-1'>
          <Clock3 className='mx-auto size-5' aria-hidden='true' />
          <p>{t('Run the full model test before submitting.')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className='space-y-3'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <ContributionTestRunStatusBadge status={props.run.status} />
        <span className='text-muted-foreground text-xs'>
          {t('{{count}} models', { count: results.length })}
        </span>
      </div>
      <div className='overflow-x-auto rounded-lg border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className='min-w-44'>{t('Model')}</TableHead>
              <TableHead className='w-32'>{t('Endpoint type')}</TableHead>
              <TableHead className='w-40'>{t('Non-stream')}</TableHead>
              <TableHead className='w-40'>{t('Stream')}</TableHead>
              <TableHead className='w-28'>{t('Price')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className='h-24 text-center'>
                  <span className='text-muted-foreground'>
                    {pending
                      ? t('Tests are starting...')
                      : t('No test results')}
                  </span>
                </TableCell>
              </TableRow>
            ) : (
              results.map((result) => (
                <TableRow key={`${result.model}-${result.endpoint_type ?? ''}`}>
                  <TableCell className='max-w-72 font-medium break-all'>
                    {result.model}
                  </TableCell>
                  <TableCell className='text-muted-foreground'>
                    {result.endpoint_type || '-'}
                  </TableCell>
                  <TableCell>
                    <ProbeCell probe={result.non_stream} pending={pending} />
                  </TableCell>
                  <TableCell>
                    <ProbeCell
                      probe={result.stream}
                      pending={pending}
                      required={result.stream_required}
                    />
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      label={
                        result.price_configured ? t('Configured') : t('Missing')
                      }
                      variant={result.price_configured ? 'success' : 'danger'}
                      copyable={false}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
