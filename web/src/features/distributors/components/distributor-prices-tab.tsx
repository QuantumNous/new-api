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
import { Edit, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import {
  deleteDistributorPrice,
  listDistributorPrices,
} from '../api'
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '../constants'
import type { DistributorPrice } from '../types'
import { DistributorPriceMutateDrawer } from './distributor-price-mutate-drawer'

export function DistributorPricesTab({
  distributorId,
}: {
  distributorId: number
}) {
  const { t } = useTranslation()
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingPrice, setEditingPrice] = useState<DistributorPrice | null>(
    null
  )
  const [deletingPrice, setDeletingPrice] = useState<DistributorPrice | null>(
    null
  )
  const [isDeleting, setIsDeleting] = useState(false)

  const triggerRefresh = () => setRefreshTrigger((prev) => prev + 1)

  const { data: prices, isLoading } = useQuery({
    queryKey: ['distributor-prices', distributorId, refreshTrigger],
    queryFn: async () => {
      const result = await listDistributorPrices(distributorId)
      if (!result.success) {
        toast.error(result.message || t(ERROR_MESSAGES.LOAD_PRICES_FAILED))
        return []
      }
      return result.data?.items ?? []
    },
  })

  const handleDelete = async () => {
    if (!deletingPrice) return
    setIsDeleting(true)
    try {
      const result = await deleteDistributorPrice(
        distributorId,
        deletingPrice.id
      )
      if (result.success) {
        toast.success(t(SUCCESS_MESSAGES.PRICE_DELETED))
        setDeletingPrice(null)
        triggerRefresh()
      }
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className='space-y-4'>
      <div className='flex justify-end'>
        <Button
          size='sm'
          onClick={() => {
            setEditingPrice(null)
            setDrawerOpen(true)
          }}
        >
          <Plus className='h-4 w-4' />
          {t('Add Price Override')}
        </Button>
      </div>

      <div className='overflow-hidden rounded-lg border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('Model')}</TableHead>
              <TableHead>{t('Input Price')}</TableHead>
              <TableHead>{t('Output Price')}</TableHead>
              <TableHead>{t('Currency')}</TableHead>
              <TableHead>{t('Unit')}</TableHead>
              <TableHead className='text-right'>{t('Actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} className='text-muted-foreground py-8 text-center'>
                  {t('Loading...')}
                </TableCell>
              </TableRow>
            )}
            {!isLoading && (prices?.length ?? 0) === 0 && (
              <TableRow>
                <TableCell colSpan={6} className='text-muted-foreground py-8 text-center'>
                  {t('No price overrides configured')}
                </TableCell>
              </TableRow>
            )}
            {(prices ?? []).map((price) => (
              <TableRow key={price.id}>
                <TableCell className='font-mono text-sm'>
                  {price.model}
                </TableCell>
                <TableCell className='tabular-nums'>
                  {price.input_price}
                </TableCell>
                <TableCell className='tabular-nums'>
                  {price.output_price}
                </TableCell>
                <TableCell>{price.currency}</TableCell>
                <TableCell>{t(price.unit)}</TableCell>
                <TableCell className='text-right'>
                  <div className='flex justify-end gap-1'>
                    <Button
                      variant='ghost'
                      size='icon-sm'
                      aria-label={t('Edit')}
                      onClick={() => {
                        setEditingPrice(price)
                        setDrawerOpen(true)
                      }}
                    >
                      <Edit />
                    </Button>
                    <Button
                      variant='ghost'
                      size='icon-sm'
                      aria-label={t('Delete')}
                      className='text-destructive'
                      onClick={() => setDeletingPrice(price)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <DistributorPriceMutateDrawer
        distributorId={distributorId}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        currentRow={editingPrice ?? undefined}
        onSaved={triggerRefresh}
      />

      <AlertDialog
        open={!!deletingPrice}
        onOpenChange={(open) => !open && setDeletingPrice(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Are you sure?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('This will permanently delete the price override for')}{' '}
              <span className='font-semibold'>{deletingPrice?.model}</span>
              {t('. This action cannot be undone.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              {t('Cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              variant='destructive'
            >
              {isDeleting ? t('Deleting...') : t('Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
