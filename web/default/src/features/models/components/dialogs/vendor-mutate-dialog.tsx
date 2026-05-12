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
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { createVendor, updateVendor } from '../../api'
import { vendorsQueryKeys, modelsQueryKeys } from '../../lib'
import { vendorFormSchema, type Vendor } from '../../types'

type VendorMutateDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentVendor?: Vendor | null
}

export function VendorMutateDialog({
  open,
  onOpenChange,
  currentVendor,
}: VendorMutateDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const isEdit = Boolean(currentVendor?.id)
  const [isSaving, setIsSaving] = useState(false)

  const form = useForm({
    resolver: zodResolver(vendorFormSchema),
    defaultValues: {
      name: '',
      description: '',
      icon: '',
      status: 1,
    },
  })

  // Load vendor data for editing
  useEffect(() => {
    if (open && isEdit && currentVendor) {
      form.reset({
        id: currentVendor.id,
        name: currentVendor.name,
        description: currentVendor.description || '',
        icon: currentVendor.icon || '',
        status: currentVendor.status || 1,
      })
    } else if (open && !isEdit) {
      form.reset({
        name: '',
        description: '',
        icon: '',
        status: 1,
      })
    }
  }, [open, isEdit, currentVendor, form])

  const onSubmit = async (values: Record<string, unknown>) => {
    setIsSaving(true)
    try {
      const response = isEdit
        ? await updateVendor({ ...values, id: currentVendor!.id })
        : await createVendor(values)

      if (response.success) {
        toast.success(
          isEdit ? 'Vendor updated successfully' : 'Vendor created successfully'
        )
        queryClient.invalidateQueries({ queryKey: vendorsQueryKeys.lists() })
        queryClient.invalidateQueries({ queryKey: modelsQueryKeys.lists() })
        onOpenChange(false)
      } else {
        toast.error(response.message || 'Operation failed')
      }
    } catch (error: unknown) {
      toast.error((error as Error)?.message || 'Operation failed')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t('Edit Vendor') : t('Create Vendor')}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? t('Update vendor information for {{name}}', {
                  name: currentVendor?.name,
                })
              : t('Add a new vendor to the system')}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
            <FormField
              control={form.control}
              name='name'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Vendor Name *')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('OpenAI, Anthropic, etc.')}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('The unique name for this vendor')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='description'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Description')}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('Describe this vendor...')}
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='icon'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Icon')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('OpenAI, Anthropic, Google, etc.')}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('@lobehub/icons key name')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                onClick={() => onOpenChange(false)}
                disabled={isSaving}
              >
                {t('Cancel')}
              </Button>
              <Button type='submit' disabled={isSaving}>
                {isSaving && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
                {isSaving ? 'Saving...' : isEdit ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
