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
import { RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { StaticDataTable } from '@/components/data-table'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { LoadingState } from '@/components/loading-state'
import { Button } from '@/components/ui/button'
import { formatTimestampToDate } from '@/lib/format'

export type MigrationOperation = {
  id: string
  source: string
  target: string
  state: 'paused' | 'committed' | 'completed' | 'aborted'
  created_at: number
  updated_at: number
  reason: string
  coordination?: {
    ready: boolean
    reason: string
    nodes: { name: string; phase: string; revision: number }[]
  }
}

type MigrationStatusCheck = {
  operation?: MigrationOperation
  checkedAt: number
}

type GroupMigrationHistoryProps = {
  operations: MigrationOperation[]
  isLoading: boolean
  errorMessage?: string
  isError: boolean
  onRetry: () => void
  onVerifyStatus: (
    operationId: string
  ) => Promise<MigrationStatusCheck | undefined>
}

export function GroupMigrationHistory(props: GroupMigrationHistoryProps) {
  const { t } = useTranslation()
  const [checkingId, setCheckingId] = useState<string>()
  const [checks, setChecks] = useState<Record<string, MigrationStatusCheck>>({})
  const [missingCheck, setMissingCheck] = useState<MigrationStatusCheck>()
  const states: Record<MigrationOperation['state'], string> = {
    paused: t('Migration paused before commit'),
    committed: t('Database committed; synchronization pending'),
    completed: t('Migration completed'),
    aborted: t('Migration aborted; preview and confirm again'),
  }

  const verifyStatus = async (operationId: string) => {
    setCheckingId(operationId)
    try {
      const result = await props.onVerifyStatus(operationId)
      if (result) {
        if (result.operation) {
          setChecks((current) => ({ ...current, [operationId]: result }))
          setMissingCheck(undefined)
        } else {
          setMissingCheck(result)
        }
      }
    } finally {
      setCheckingId(undefined)
    }
  }

  if (props.isLoading) {
    return <LoadingState inline message={t('Loading...')} />
  }

  if (props.isError) {
    return (
      <ErrorState
        className='min-h-0'
        title={props.errorMessage}
        onRetry={props.onRetry}
      />
    )
  }

  if (props.operations.length === 0) {
    return (
      <div className='flex flex-col gap-3'>
        {missingCheck && (
          <p role='status' className='text-muted-foreground text-sm'>
            {t('No migration operation found. Last checked at {{time}}.', {
              time: formatTimestampToDate(
                missingCheck.checkedAt,
                'milliseconds'
              ),
            })}
          </p>
        )}
        <EmptyState
          className='min-h-0'
          title={t('No migration history yet.')}
        />
      </div>
    )
  }

  return (
    <section className='flex min-w-0 flex-col gap-2'>
      <div>
        <h3 className='text-sm font-medium'>{t('Migration history')}</h3>
        <p className='text-muted-foreground text-xs'>
          {t('Showing the 20 most recent operations.')}
        </p>
      </div>
      {missingCheck && (
        <p role='status' className='text-muted-foreground text-sm'>
          {t('No migration operation found. Last checked at {{time}}.', {
            time: formatTimestampToDate(missingCheck.checkedAt, 'milliseconds'),
          })}
        </p>
      )}
      <div className='overflow-x-auto'>
        <StaticDataTable
          tableClassName='min-w-[760px]'
          tableProps={{ 'aria-label': t('Migration history') }}
          data={props.operations}
          getRowKey={(operation) => operation.id}
          columns={[
            {
              id: 'groups',
              header: t('Group change'),
              className: 'min-w-40',
              cell: (operation) => (
                <div className='flex min-w-0 flex-col'>
                  <span className='break-all'>
                    {operation.source} → {operation.target}
                  </span>
                  <span className='text-muted-foreground text-xs break-all'>
                    {operation.id}
                  </span>
                </div>
              ),
            },
            {
              id: 'status',
              header: t('Status'),
              className: 'min-w-44',
              cell: (operation) => {
                const check = checks[operation.id]
                return (
                  <div className='flex min-w-0 flex-col gap-1'>
                    <span>{states[operation.state]}</span>
                    {operation.reason && (
                      <span className='text-muted-foreground text-xs'>
                        {t(operation.reason)}
                      </span>
                    )}
                    {check && (
                      <span
                        role='status'
                        className='text-muted-foreground text-xs'
                      >
                        {check.operation
                          ? t(
                              'Migration status: {{status}}. Last checked at {{time}}.',
                              {
                                status: states[check.operation.state],
                                time: formatTimestampToDate(
                                  check.checkedAt,
                                  'milliseconds'
                                ),
                              }
                            )
                          : t(
                              'No migration operation found. Last checked at {{time}}.',
                              {
                                time: formatTimestampToDate(
                                  check.checkedAt,
                                  'milliseconds'
                                ),
                              }
                            )}
                      </span>
                    )}
                  </div>
                )
              },
            },
            {
              id: 'created',
              header: t('Created'),
              className: 'min-w-36',
              cell: (operation) => formatTimestampToDate(operation.created_at),
            },
            {
              id: 'updated',
              header: t('Updated'),
              className: 'min-w-36',
              cell: (operation) => formatTimestampToDate(operation.updated_at),
            },
            {
              id: 'action',
              header: t('Action'),
              className: 'w-40',
              cell: (operation) => (
                <Button
                  type='button'
                  size='sm'
                  variant='outline'
                  disabled={checkingId === operation.id}
                  onClick={() => void verifyStatus(operation.id)}
                >
                  <RefreshCw className='mr-2 size-4' aria-hidden='true' />
                  {checkingId === operation.id
                    ? t('Loading...')
                    : t('Verify migration status')}
                </Button>
              ),
            },
          ]}
        />
      </div>
    </section>
  )
}
