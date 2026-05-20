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
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { getCurrencyDisplay } from '@/lib/currency'
import { addTimeToDate } from '@/lib/time'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
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
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { DateTimePicker } from '@/components/datetime-picker'
import { createRedemption, updateRedemption, getRedemption } from '../api'
import {
  ERROR_MESSAGES,
  REDEMPTION_OUTLINE_BUTTON_CLASS,
  SUCCESS_MESSAGES,
} from '../constants'
import {
  getRedemptionFormSchema,
  type RedemptionFormValues,
  REDEMPTION_FORM_DEFAULT_VALUES,
  transformFormDataToPayload,
  transformRedemptionToFormDefaults,
} from '../lib'
import { type Redemption } from '../types'
import { useRedemptions } from './redemptions-provider'

type RedemptionsMutateDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow?: Redemption
}

export function RedemptionsMutateDrawer({
  open,
  onOpenChange,
  currentRow,
}: RedemptionsMutateDrawerProps) {
  const { t } = useTranslation()
  const isUpdate = !!currentRow
  const { triggerRefresh } = useRedemptions()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const expiryPresetButtonClass =
    'border-slate-300 text-slate-800 hover:bg-slate-100 hover:text-slate-900 disabled:border-slate-200 disabled:bg-slate-100/60 disabled:text-slate-400 dark:border-white/15 dark:bg-white/10 dark:text-slate-100 dark:hover:bg-white/15 dark:hover:text-white dark:disabled:border-white/10 dark:disabled:bg-white/5 dark:disabled:text-slate-400'

  const form = useForm<RedemptionFormValues>({
    resolver: zodResolver(getRedemptionFormSchema(t)),
    defaultValues: REDEMPTION_FORM_DEFAULT_VALUES,
  })

  // Load existing data when updating
  useEffect(() => {
    if (open && isUpdate && currentRow) {
      // For update, fetch fresh data
      getRedemption(currentRow.id).then((result) => {
        if (result.success && result.data) {
          form.reset(transformRedemptionToFormDefaults(result.data))
        }
      })
    } else if (open && !isUpdate) {
      // For create, reset to defaults
      form.reset(REDEMPTION_FORM_DEFAULT_VALUES)
    }
  }, [open, isUpdate, currentRow, form])

  const onSubmit = async (data: RedemptionFormValues) => {
    setIsSubmitting(true)
    try {
      const basePayload = transformFormDataToPayload(data)

      if (isUpdate && currentRow) {
        const result = await updateRedemption({
          ...basePayload,
          id: currentRow.id,
        })
        if (result.success) {
          toast.success(t(SUCCESS_MESSAGES.REDEMPTION_UPDATED))
          onOpenChange(false)
          triggerRefresh()
        } else {
          toast.error(t(ERROR_MESSAGES.UPDATE_FAILED))
        }
      } else {
        // Create mode
        const result = await createRedemption(basePayload)
        if (result.success) {
          const count = result.data?.length || 0
          toast.success(
            count > 1
              ? t('Redemption successfully created count', {
                  count,
                })
              : t(SUCCESS_MESSAGES.REDEMPTION_CREATED)
          )
          onOpenChange(false)
          triggerRefresh()
        } else {
          const message = typeof result.message === 'string' ? result.message : ''
          const hasChineseContent = /[\u4e00-\u9fff]/.test(message)
          toast.error(t(ERROR_MESSAGES.CREATE_FAILED), {
            description: hasChineseContent ? message : undefined,
          })
        }
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSetExpiry = (months: number, days: number, hours: number) => {
    const newDate = addTimeToDate(months, days, hours)
    form.setValue('expired_time', newDate)
  }

  const { meta: currencyMeta } = getCurrencyDisplay()
  const tokensOnly = currencyMeta.kind === 'tokens'
  const quotaLabel = t('Redemption form quota label')
  const quotaPlaceholder = tokensOnly
    ? t('Redemption form enter token quota')
    : t('Redemption form enter redeem quota')

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v)
        if (!v) {
          form.reset()
        }
      }}
    >
      <SheetContent className='flex h-dvh w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[600px]'>
        <SheetHeader className='border-b px-4 py-3 text-start sm:px-6 sm:py-4'>
          <SheetTitle>
            {isUpdate
              ? t('Update resource redemption code')
              : t('Create resource redemption code sheet')}
          </SheetTitle>
          <SheetDescription>
            {isUpdate
              ? t('Redemption form update description')
              : t('Redemption form create description')}{' '}
            {t('Redemption form save hint')}
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form
            id='redemption-form'
            onSubmit={form.handleSubmit(onSubmit)}
            className='flex-1 space-y-4 overflow-y-auto px-3 py-3 pb-4 sm:space-y-6 sm:px-4'
          >
            <FormField
              control={form.control}
              name='name'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Redemption form name label')}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder={t('Redemption form name placeholder')}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('Redemption form name description')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='quota_dollars'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{quotaLabel}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type='number'
                      step={tokensOnly ? 1 : 0.01}
                      placeholder={quotaPlaceholder}
                      onChange={(e) =>
                        field.onChange(parseFloat(e.target.value) || 0)
                      }
                    />
                  </FormControl>
                  <FormDescription>
                    {tokensOnly
                      ? t('Redemption form quota help tokens')
                      : t('Redemption form quota help cny')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='expired_time'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Redemption form expiry label')}</FormLabel>
                  <div className='space-y-2'>
                    <FormControl>
                      <DateTimePicker
                        value={field.value}
                        onChange={field.onChange}
                        placeholder={t('Redemption form expiry never placeholder')}
                      />
                    </FormControl>
                    <div className='grid grid-cols-4 gap-1.5 sm:flex sm:gap-2'>
                      <Button
                        type='button'
                        variant='outline'
                        size='sm'
                        className={cn(expiryPresetButtonClass)}
                        onClick={() => handleSetExpiry(0, 0, 0)}
                      >
                        {t('Redemption expiry preset never')}
                      </Button>
                      <Button
                        type='button'
                        variant='outline'
                        size='sm'
                        className={cn(expiryPresetButtonClass)}
                        onClick={() => handleSetExpiry(1, 0, 0)}
                      >
                        {t('Redemption expiry preset one month')}
                      </Button>
                      <Button
                        type='button'
                        variant='outline'
                        size='sm'
                        className={cn(expiryPresetButtonClass)}
                        onClick={() => handleSetExpiry(0, 7, 0)}
                      >
                        {t('Redemption expiry preset one week')}
                      </Button>
                      <Button
                        type='button'
                        variant='outline'
                        size='sm'
                        className={cn(expiryPresetButtonClass)}
                        onClick={() => handleSetExpiry(0, 1, 0)}
                      >
                        {t('Redemption expiry preset one day')}
                      </Button>
                    </div>
                  </div>
                  <FormDescription>
                    {t('Redemption form expiry leave empty')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {!isUpdate && (
              <FormField
                control={form.control}
                name='count'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Redemption form quantity label')}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type='number'
                        min='1'
                        max='100'
                        placeholder={t('Redemption form quantity placeholder')}
                        onChange={(e) =>
                          field.onChange(parseInt(e.target.value, 10) || 1)
                        }
                      />
                    </FormControl>
                    <FormDescription>
                      {t('Redemption form quantity description')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </form>
        </Form>
        <SheetFooter className='grid grid-cols-2 gap-2 border-t px-4 py-3 sm:flex sm:px-6 sm:py-4'>
          <SheetClose
            render={
              <Button
                variant='outline'
                className={cn(REDEMPTION_OUTLINE_BUTTON_CLASS)}
              />
            }
          >
            {t('Close')}
          </SheetClose>
          <Button form='redemption-form' type='submit' disabled={isSubmitting}>
            {isSubmitting ? t('Saving...') : t('Save changes')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
