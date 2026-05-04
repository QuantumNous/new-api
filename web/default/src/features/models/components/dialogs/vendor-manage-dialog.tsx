import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { getLobeIcon } from '@/lib/lobe-icon'
import { getVendors } from '../../api'
import { vendorsQueryKeys } from '../../lib'
import { handleDeleteVendor } from '../../lib/vendor-actions'
import type { Vendor } from '../../types'
import { useModels } from '../models-provider'

type VendorManageDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function VendorManageDialog({
  open,
  onOpenChange,
}: VendorManageDialogProps) {
  const { t } = useTranslation()
  const { setOpen, setCurrentVendor } = useModels()
  const queryClient = useQueryClient()
  const [deleteTarget, setDeleteTarget] = useState<Vendor | null>(null)

  const { data } = useQuery({
    queryKey: vendorsQueryKeys.list(),
    queryFn: () => getVendors({ page_size: 1000 }),
    enabled: open,
  })

  const vendors = data?.data ?? []

  const handleEdit = (vendor: Vendor) => {
    setCurrentVendor(vendor)
    setOpen('update-vendor')
  }

  const handleCreate = () => {
    setCurrentVendor(null)
    setOpen('create-vendor')
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className='max-w-lg'>
          <DialogHeader>
            <DialogTitle>{t('Manage Vendors')}</DialogTitle>
            <DialogDescription>
              {t('Create, edit, or delete vendors')}
            </DialogDescription>
          </DialogHeader>

          <div className='max-h-80 space-y-2 overflow-y-auto'>
            {vendors.length === 0 && (
              <p className='text-muted-foreground py-4 text-center text-sm'>
                {t('No vendors yet')}
              </p>
            )}
            {vendors.map((vendor) => {
              const icon = vendor.icon
                ? getLobeIcon(vendor.icon, 20)
                : null
              return (
                <div
                  key={vendor.id}
                  className='flex items-center justify-between rounded-lg border px-3 py-2'
                >
                  <div className='flex items-center gap-2'>
                    {icon}
                    <div>
                      <div className='text-sm font-medium'>
                        {vendor.name}
                      </div>
                      {vendor.description && (
                        <div className='text-muted-foreground text-xs'>
                          {vendor.description}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className='flex items-center gap-1'>
                    <Button
                      variant='ghost'
                      size='icon'
                      className='h-8 w-8'
                      onClick={() => handleEdit(vendor)}
                    >
                      <Pencil className='h-4 w-4' />
                    </Button>
                    <Button
                      variant='ghost'
                      size='icon'
                      className='text-destructive hover:text-destructive h-8 w-8'
                      onClick={() => setDeleteTarget(vendor)}
                    >
                      <Trash2 className='h-4 w-4' />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>

          <Button onClick={handleCreate} className='w-full'>
            <Plus className='mr-2 h-4 w-4' />
            {t('Create Vendor')}
          </Button>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title={t('Delete Vendor')}
        desc={t('Are you sure you want to delete "{{name}}"?', {
          name: deleteTarget?.name,
        })}
        confirmText={t('Delete')}
        destructive
        handleConfirm={() => {
          if (deleteTarget) {
            handleDeleteVendor(deleteTarget.id, queryClient)
            setDeleteTarget(null)
          }
        }}
      />
    </>
  )
}
