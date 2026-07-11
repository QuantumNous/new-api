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
import { flexRender, type Row } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'

import { DataTableCardField, DataTableCardRow } from '@/components/data-table'
import { StatusBadge } from '@/components/status-badge'
import { formatQuota } from '@/lib/format'

import type { ApiKey } from '../types'

function renderApiKeyCell(row: Row<ApiKey>, columnId: string) {
  const cell = row
    .getVisibleCells()
    .find((candidate) => candidate.column.id === columnId)
  if (!cell) return null
  return flexRender(cell.column.columnDef.cell, cell.getContext())
}

function ApiKeyModels(props: { apiKey: ApiKey }) {
  const { t } = useTranslation()

  if (!props.apiKey.model_limits_enabled || !props.apiKey.model_limits) {
    return <StatusBadge variant='neutral'>{t('Unlimited')}</StatusBadge>
  }

  const models = props.apiKey.model_limits
    .split(',')
    .map((model) => model.trim())
    .filter(Boolean)

  return (
    <span className='font-mono text-xs whitespace-pre-wrap'>
      {models.join(', ')}
    </span>
  )
}

function ApiKeyIpRestrictions(props: { apiKey: ApiKey }) {
  const { t } = useTranslation()
  const allowIps = props.apiKey.allow_ips?.trim()

  if (!allowIps) {
    return <StatusBadge variant='neutral'>{t('No restriction')}</StatusBadge>
  }

  const ips = allowIps
    .split('\n')
    .map((ip) => ip.trim())
    .filter(Boolean)

  return (
    <span className='font-mono text-xs whitespace-pre-wrap'>
      {ips.join('\n')}
    </span>
  )
}

export function ApiKeyCard(props: { row: Row<ApiKey> }) {
  const { t } = useTranslation()
  const apiKey = props.row.original
  const totalQuota = apiKey.used_quota + apiKey.remain_quota
  const visibleColumnIds = new Set(
    props.row.getVisibleCells().map((cell) => cell.column.id)
  )

  const hasMetaRows = [
    'group',
    'quota',
    'created_time',
    'accessed_time',
    'expired_time',
  ].some((columnId) => visibleColumnIds.has(columnId))
  const hasDetailSections =
    visibleColumnIds.has('model_limits') || visibleColumnIds.has('allow_ips')

  return (
    <div className='flex min-w-0 flex-col'>
      <div className='flex min-w-0 items-start justify-between gap-3'>
        <div className='min-w-0 flex-1'>
          {visibleColumnIds.has('name') && (
            <div className='text-[15px] leading-tight font-semibold break-words'>
              {renderApiKeyCell(props.row, 'name')}
            </div>
          )}
          {visibleColumnIds.has('key') && (
            <div className='mt-1.5 min-w-0'>
              {renderApiKeyCell(props.row, 'key')}
            </div>
          )}
        </div>
        {visibleColumnIds.has('status') && (
          <div className='shrink-0'>
            {renderApiKeyCell(props.row, 'status')}
          </div>
        )}
      </div>

      {hasMetaRows && (
        <div className='mt-3 space-y-0.5 border-t pt-3'>
          {visibleColumnIds.has('quota') && (
            <DataTableCardRow label={t('Quota')} contentMode='full'>
              {apiKey.unlimited_quota ? (
                <StatusBadge variant='neutral'>{t('Unlimited')}</StatusBadge>
              ) : (
                <span className='font-medium tabular-nums'>
                  {formatQuota(apiKey.remain_quota)}
                  <span className='text-muted-foreground font-normal'>
                    {' / '}
                    {formatQuota(totalQuota)}
                  </span>
                </span>
              )}
            </DataTableCardRow>
          )}
          {visibleColumnIds.has('group') && (
            <DataTableCardRow label={t('Group')} contentMode='full'>
              {renderApiKeyCell(props.row, 'group')}
            </DataTableCardRow>
          )}
          {visibleColumnIds.has('created_time') && (
            <DataTableCardRow label={t('Created')} contentMode='full'>
              {renderApiKeyCell(props.row, 'created_time')}
            </DataTableCardRow>
          )}
          {visibleColumnIds.has('accessed_time') && (
            <DataTableCardRow label={t('Last Used')} contentMode='full'>
              {renderApiKeyCell(props.row, 'accessed_time')}
            </DataTableCardRow>
          )}
          {visibleColumnIds.has('expired_time') && (
            <DataTableCardRow label={t('Expires')} contentMode='full'>
              {renderApiKeyCell(props.row, 'expired_time')}
            </DataTableCardRow>
          )}
        </div>
      )}

      {hasDetailSections && (
        <div className='mt-3 space-y-3 border-t pt-3'>
          {visibleColumnIds.has('model_limits') && (
            <DataTableCardField label={t('Models')} contentMode='full'>
              <ApiKeyModels apiKey={apiKey} />
            </DataTableCardField>
          )}
          {visibleColumnIds.has('allow_ips') && (
            <DataTableCardField label={t('IP Restriction')} contentMode='full'>
              <ApiKeyIpRestrictions apiKey={apiKey} />
            </DataTableCardField>
          )}
        </div>
      )}

      {visibleColumnIds.has('actions') && (
        <div className='mt-3 flex justify-end border-t pt-2'>
          {renderApiKeyCell(props.row, 'actions')}
        </div>
      )}
    </div>
  )
}
