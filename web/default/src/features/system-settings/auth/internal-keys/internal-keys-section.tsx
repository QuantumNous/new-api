import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { CopyButton } from '@/components/copy-button'
import { BadgeCell } from '@/components/data-table/core/badge-cell'
import { StaticDataTable } from '@/components/data-table/static/static-data-table'
import { StaticRowActions } from '@/components/data-table/static/static-row-actions'
import { Button } from '@/components/design-system/button'
import { StatusBadge } from '@/components/status-badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import dayjs from '@/lib/dayjs'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

import { SettingsSection } from '../../components/settings-section'
import { InternalKeyFormDialog } from './components/internal-key-form-dialog'
import { useDeleteInternalKey, useInternalKeys } from './hooks'
import { INTERNAL_KEY_STATUS, type InternalKey } from './types'

const INTERNAL_REQUEST_HEADERS = ['X-Key-Id', 'X-Key'] as const

function formatUnixTime(ts: number, t: (key: string) => string) {
  if (!ts) return t('Never')
  return dayjs(ts * 1000).format('YYYY-MM-DD HH:mm')
}

function maskSecret(secret: string) {
  if (secret.length <= 8) return '*'.repeat(secret.length)
  return `${secret.slice(0, 4)}…${secret.slice(-4)}`
}

export function InternalKeysSection() {
  const { t } = useTranslation()
  const user = useAuthStore((state) => state.auth.user)
  const isSuperAdmin = (user?.role ?? 0) >= ROLE.SUPER_ADMIN
  const { data: keys = [], isLoading } = useInternalKeys()
  const deleteKey = useDeleteInternalKey()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingKey, setEditingKey] = useState<InternalKey | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<InternalKey | null>(null)

  if (!isSuperAdmin) {
    return (
      <SettingsSection title={t('Internal System Authentication')}>
        <p className='text-muted-foreground text-sm'>
          {t('This section can only be managed by the super administrator.')}
        </p>
      </SettingsSection>
    )
  }

  const handleCreate = () => {
    setEditingKey(null)
    setDialogOpen(true)
  }

  const handleEdit = (keyRecord: InternalKey) => {
    setEditingKey(keyRecord)
    setDialogOpen(true)
  }

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open)
    if (!open) {
      setEditingKey(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    await deleteKey.mutateAsync(deleteTarget.id)
    setDeleteTarget(null)
  }

  if (isLoading) {
    return (
      <SettingsSection title={t('Internal System Authentication')}>
        <div className='text-muted-foreground py-8 text-center text-sm'>
          {t('Loading...')}
        </div>
      </SettingsSection>
    )
  }

  return (
    <SettingsSection title={t('Internal System Authentication')}>
      <p className='text-muted-foreground text-sm'>
        {t(
          'Manage key pairs that internal systems use to authenticate when calling this instance.'
        )}
      </p>

      <Alert>
        <AlertTitle>{t('Request headers')}</AlertTitle>
        <AlertDescription className='space-y-2 text-sm'>
          <p>
            {t(
              'Internal systems authenticate by sending both of the following request headers:'
            )}
          </p>
          <div className='space-y-1.5'>
            {INTERNAL_REQUEST_HEADERS.map((header) => (
              <div
                key={header}
                className='flex min-w-0 items-center justify-between gap-2'
              >
                <code className='bg-muted text-foreground rounded px-1.5 py-0.5 text-xs'>
                  {header}
                </code>
                <CopyButton
                  value={header}
                  size='icon-sm'
                  tooltip={t('Copy')}
                  aria-label={t('Copy')}
                />
              </div>
            ))}
          </div>
        </AlertDescription>
      </Alert>

      <div className='flex items-center justify-between'>
        <p className='text-muted-foreground text-sm'>
          {t('Add one key pair per internal system.')}
        </p>
        <Button onClick={handleCreate}>
          <Plus className='mr-1.5 h-4 w-4' />
          {t('Add Key')}
        </Button>
      </div>

      <StaticDataTable
        data={keys}
        getRowKey={(keyRecord) => keyRecord.id}
        emptyClassName='text-sm'
        emptyContent={t('No internal keys configured yet.')}
        columns={[
          {
            id: 'key-id',
            header: t('Key ID'),
            cell: (keyRecord) => (
              <BadgeCell>
                <StatusBadge variant='neutral'>{keyRecord.key_id}</StatusBadge>
              </BadgeCell>
            ),
          },
          {
            id: 'name',
            header: t('Name'),
            cellClassName: 'font-medium',
            cell: (keyRecord) => keyRecord.name || '--',
          },
          {
            id: 'key',
            header: t('Key'),
            cell: (keyRecord) => (
              <span className='flex items-center gap-1'>
                <span className='text-muted-foreground max-w-[160px] truncate font-mono text-xs'>
                  {maskSecret(keyRecord.key)}
                </span>
                <CopyButton
                  value={keyRecord.key}
                  size='icon-sm'
                  tooltip={t('Copy')}
                  aria-label={t('Copy')}
                />
              </span>
            ),
          },
          {
            id: 'status',
            header: t('Status'),
            cell: (keyRecord) => (
              <BadgeCell>
                <StatusBadge
                  variant={
                    keyRecord.status === INTERNAL_KEY_STATUS.ENABLED
                      ? 'success'
                      : 'neutral'
                  }
                >
                  {keyRecord.status === INTERNAL_KEY_STATUS.ENABLED
                    ? t('Enabled')
                    : t('Disabled')}
                </StatusBadge>
              </BadgeCell>
            ),
          },
          {
            id: 'accessed-time',
            header: t('Last used'),
            cellClassName: 'tabular-nums',
            cell: (keyRecord) => formatUnixTime(keyRecord.accessed_time, t),
          },
          {
            id: 'created-time',
            header: t('Created'),
            cellClassName: 'tabular-nums',
            cell: (keyRecord) => formatUnixTime(keyRecord.created_time, t),
          },
          {
            id: 'actions',
            header: t('Actions'),
            className: 'text-right',
            cellClassName: 'text-right',
            cell: (keyRecord) => (
              <StaticRowActions
                editLabel={t('Edit')}
                deleteLabel={t('Delete')}
                menuLabel={t('Open menu')}
                onEdit={() => handleEdit(keyRecord)}
                onDelete={() => setDeleteTarget(keyRecord)}
              />
            ),
          },
        ]}
      />

      <InternalKeyFormDialog
        open={dialogOpen}
        onOpenChange={handleDialogChange}
        keyRecord={editingKey}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t('Delete Key')}
        desc={t(
          'Are you sure you want to delete "{{name}}"? Internal systems using this key will immediately lose access.',
          { name: deleteTarget?.key_id || '' }
        )}
        confirmText={t('Delete')}
        destructive
        handleConfirm={handleDelete}
        isLoading={deleteKey.isPending}
      />
    </SettingsSection>
  )
}
