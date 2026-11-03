/*
Copyright (C) 2023-2026 QuantumNous
*/
import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { BadgeCell } from '@/components/data-table/core/badge-cell'
import { StaticDataTable } from '@/components/data-table/static/static-data-table'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { formatTimestamp } from '@/lib/format'

import type { PartnerOAuthClient } from '../types'

export function PartnerOAuthClientsTable(props: {
  clients: PartnerOAuthClient[]
  canWrite: boolean
  canOperate: boolean
  onCreate: () => void
  onEdit: (client: PartnerOAuthClient) => void
  onToggle: (client: PartnerOAuthClient) => void
  onRotate: (client: PartnerOAuthClient) => void
  onDelete: (client: PartnerOAuthClient) => void
  onServerAccess: (client: PartnerOAuthClient) => void
}) {
  const { t } = useTranslation()

  return (
    <div className='space-y-3'>
      <div className='flex items-center justify-between gap-3'>
        <p className='text-muted-foreground text-sm'>
          {t(
            'Register third-party assistants that bind a user account and receive a dedicated API key.'
          )}
        </p>
        {props.canWrite && (
          <Button size='sm' onClick={props.onCreate}>
            <Plus className='mr-1.5 h-4 w-4' />
            {t('Create client')}
          </Button>
        )}
      </div>
      <StaticDataTable
        data={props.clients}
        getRowKey={(client) => client.client_id}
        emptyContent={t('No partner OAuth clients yet.')}
        columns={[
          {
            id: 'name',
            header: t('Name'),
            cell: (client) => client.name,
          },
          {
            id: 'client_id',
            header: t('Client ID'),
            cell: (client) => (
              <span className='font-mono text-xs'>{client.client_id}</span>
            ),
          },
          {
            id: 'type',
            header: t('Type'),
            cell: (client) =>
              client.token_auth_method === 'none'
                ? t('Public')
                : t('Confidential'),
          },
          {
            id: 'status',
            header: t('Status'),
            cell: (client) => (
              <BadgeCell>
                <StatusBadge
                  label={client.status === 1 ? t('Enabled') : t('Disabled')}
                  variant={client.status === 1 ? 'success' : 'neutral'}
                  copyable={false}
                />
              </BadgeCell>
            ),
          },
          {
            id: 'updated',
            header: t('Updated'),
            cell: (client) => formatTimestamp(client.updated_at),
          },
          {
            id: 'actions',
            header: t('Actions'),
            className: 'text-end',
            cell: (client) => (
              <div className='flex justify-end gap-1'>
                <Button
                  type='button'
                  size='sm'
                  variant='outline'
                  onClick={() => props.onServerAccess(client)}
                >
                  {t('Server access')}
                </Button>
                {props.canOperate && (
                  <Button
                    type='button'
                    size='sm'
                    variant='outline'
                    onClick={() => props.onToggle(client)}
                  >
                    {client.status === 1 ? t('Disable') : t('Enable')}
                  </Button>
                )}
                {props.canWrite && (
                  <>
                    <Button
                      type='button'
                      size='sm'
                      variant='outline'
                      onClick={() => props.onEdit(client)}
                    >
                      {t('Edit')}
                    </Button>
                    {client.token_auth_method === 'client_secret_basic' && (
                      <Button
                        type='button'
                        size='sm'
                        variant='outline'
                        onClick={() => props.onRotate(client)}
                      >
                        {t('Rotate secret')}
                      </Button>
                    )}
                    <Button
                      type='button'
                      size='sm'
                      variant='destructive'
                      onClick={() => props.onDelete(client)}
                    >
                      {t('Delete')}
                    </Button>
                  </>
                )}
              </div>
            ),
          },
        ]}
      />
    </div>
  )
}
