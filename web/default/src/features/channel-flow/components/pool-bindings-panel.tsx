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

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StaticDataTable } from '@/components/data-table/static/static-data-table'
import type { ChannelFlowPool, ChannelFlowPoolBinding } from '../types'

type PoolBindingsPanelProps = {
  pool?: ChannelFlowPool | null
  bindings: ChannelFlowPoolBinding[]
  loading: boolean
  deletingBindingId?: number | null
  onAddBinding: () => void
  onDeleteBinding: (binding: ChannelFlowPoolBinding) => void
}

export function PoolBindingsPanel(props: PoolBindingsPanelProps) {
  const { t } = useTranslation()

  return (
    <div className='rounded-lg border p-4'>
      <div className='mb-3 flex flex-wrap items-center justify-between gap-2'>
        <div>
          <h3 className='text-sm font-semibold'>{t('Channel bindings')}</h3>
          <p className='text-muted-foreground mt-1 text-xs'>
            {t('Bindings attach pool capacity to channels; upstream URLs remain configured on each channel.')}
          </p>
        </div>
        <Button
          size='sm'
          onClick={props.onAddBinding}
          disabled={!props.pool}
        >
          <Plus className='size-4' />
          {t('Bind channel')}
        </Button>
      </div>

      {props.loading ? (
        <div className='space-y-2'>
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className='h-11 rounded-lg' />
          ))}
        </div>
      ) : (
        (() => {
          const columns = useMemo(
            () => [
              {
                id: 'channel',
                header: t('Channel'),
                cell: (binding: ChannelFlowPoolBinding) => (
                  <div>
                    <div className='font-medium tabular-nums'>
                      #{binding.channel_id}
                    </div>
                    <div className='text-muted-foreground text-xs'>
                      {t('Pool ID')} #{binding.pool_id}
                    </div>
                  </div>
                ),
              },
              {
                id: 'mode',
                header: t('Mode'),
                className: 'hidden sm:table-cell',
                cellClassName: 'hidden sm:table-cell',
                cell: (binding: ChannelFlowPoolBinding) => (
                  <Badge variant='outline'>
                    {binding.match_mode === 'channel_model'
                      ? t('Channel and model')
                      : t('Channel')}
                  </Badge>
                ),
              },
              {
                id: 'enabled',
                header: t('Status'),
                cell: (binding: ChannelFlowPoolBinding) => (
                  <Badge variant={binding.enabled ? 'default' : 'secondary'}>
                    {binding.enabled ? t('Enabled') : t('Disabled')}
                  </Badge>
                ),
              },
              {
                id: 'actions',
                header: '',
                className: 'w-16 text-right',
                cellClassName: 'text-right',
                cell: (binding: ChannelFlowPoolBinding) => (
                  <Button
                    variant='ghost'
                    size='icon-sm'
                    aria-label={t('Delete binding')}
                    disabled={props.deletingBindingId === binding.id}
                    onClick={() => props.onDeleteBinding(binding)}
                  >
                    <Trash2 className='size-4' />
                  </Button>
                ),
              },
            ],
            [t, props.deletingBindingId, props.onDeleteBinding]
          )
          const emptyContent = useMemo(
            () => (
              <span className='text-muted-foreground'>
                {props.pool
                  ? t('No channels bound to this Flow Pool')
                  : t('Select a Flow Pool to view bindings')}
              </span>
            ),
            [props.pool, t]
          )
          return (
            <StaticDataTable
              data={props.bindings}
              getRowKey={(binding) => binding.id}
              columns={columns}
              emptyContent={emptyContent}
            />
          )
        })()
      )}
    </div>
  )
}
