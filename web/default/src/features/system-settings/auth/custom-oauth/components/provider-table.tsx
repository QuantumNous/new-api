import { useState } from 'react'
import { Pencil, Trash2, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { StatusBadge } from '@/components/status-badge'
import { useDeleteProvider } from '../hooks/use-custom-oauth-mutations'
import type { CustomOAuthProvider } from '../types'

type ProviderTableProps = {
  providers: CustomOAuthProvider[]
  onEdit: (provider: CustomOAuthProvider) => void
  onCreate: () => void
}

export function ProviderTable(props: ProviderTableProps) {
  const { t } = useTranslation()
  const deleteProvider = useDeleteProvider()
  const [deleteTarget, setDeleteTarget] = useState<CustomOAuthProvider | null>(
    null
  )

  const handleDelete = async () => {
    if (!deleteTarget) return
    await deleteProvider.mutateAsync(deleteTarget.id)
    setDeleteTarget(null)
  }

  return (
    <>
      <div className='flex items-center justify-between'>
        <p className='text-muted-foreground text-sm'>
          {t('Manage custom OAuth providers for user authentication')}
        </p>
        <Button size='sm' onClick={props.onCreate}>
          <Plus className='mr-1.5 h-4 w-4' />
          {t('Add Provider')}
        </Button>
      </div>

      {props.providers.length === 0 ? (
        <div className='text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm'>
          {t('No custom OAuth providers configured yet.')}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('Icon')}</TableHead>
              <TableHead>{t('Name')}</TableHead>
              <TableHead>{t('Slug')}</TableHead>
              <TableHead>{t('Status')}</TableHead>
              <TableHead>{t('Client ID')}</TableHead>
              <TableHead className='text-right'>{t('Actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.providers.map((provider) => (
              <TableRow key={provider.id}>
                <TableCell>
                  {provider.icon ? (
                    <span className='text-lg'>{provider.icon}</span>
                  ) : (
                    <span className='text-muted-foreground text-xs'>--</span>
                  )}
                </TableCell>
                <TableCell className='font-medium'>{provider.name}</TableCell>
                <TableCell>
                  <StatusBadge
                    label={provider.slug}
                    variant='neutral'
                    copyable={false}
                  />
                </TableCell>
                <TableCell>
                  <StatusBadge
                    label={provider.enabled ? t('Enabled') : t('Disabled')}
                    variant={provider.enabled ? 'success' : 'neutral'}
                    copyable={false}
                  />
                </TableCell>
                <TableCell className='text-muted-foreground max-w-[120px] truncate font-mono text-xs'>
                  {provider.client_id}
                </TableCell>
                <TableCell className='text-right'>
                  <div className='flex justify-end gap-1'>
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={() => props.onEdit(provider)}
                    >
                      <Pencil className='h-4 w-4' />
                    </Button>
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={() => setDeleteTarget(provider)}
                    >
                      <Trash2 className='text-destructive h-4 w-4' />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t('Delete Provider')}
        desc={t(
          'Are you sure you want to delete "{{name}}"? Users who authenticated with this provider will no longer be able to log in.',
          { name: deleteTarget?.name || '' }
        )}
        confirmText={t('Delete')}
        destructive
        handleConfirm={handleDelete}
        isLoading={deleteProvider.isPending}
      />
    </>
  )
}
