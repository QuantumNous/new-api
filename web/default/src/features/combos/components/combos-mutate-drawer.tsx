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
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  sideDrawerContentClassName,
  sideDrawerFooterClassName,
  sideDrawerFormClassName,
  sideDrawerHeaderClassName,
  sideDrawerSwitchItemClassName,
} from '@/components/drawer-layout'
import { createCombo, updateCombo, getCombo } from '../api'
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '../constants'
import { comboFormSchema, type ComboFormValues, type ComboFormData } from '../types'
import { useCombos } from './combos-provider'
import type { Combo } from '../types'

type ComboMutateDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow?: Combo
}

const DEFAULT_COMBO_FORM_VALUES: ComboFormValues = {
  name: '',
  models: '',
  strategy: 'fallback',
  weights: '',
  status: 1,
}

export function CombosMutateDrawer({
  open,
  onOpenChange,
  currentRow,
}: ComboMutateDrawerProps) {
  const { t } = useTranslation()
  const isUpdate = !!currentRow
  const { triggerRefresh } = useCombos()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<ComboFormValues>({
    resolver: zodResolver(comboFormSchema),
    defaultValues: { ...DEFAULT_COMBO_FORM_VALUES },
  })

  const strategy = form.watch('strategy')
  const showWeights = strategy === 'weighted'

  useEffect(() => {
    let active = true
    const targetId = currentRow?.id

    if (open && isUpdate && targetId) {
      void (async () => {
        try {
          const result = await getCombo(targetId)
          if (!active || currentRow?.id !== targetId) return
          form.reset({
            name: result.name,
            models: result.models ?? '',
            strategy: result.strategy,
            weights: result.weights ?? '',
            status: result.status,
          })
        } catch {
          if (active) toast.error(t(ERROR_MESSAGES.FETCH_ONE_FAILED))
        }
      })()
    } else if (open && !isUpdate) {
      form.reset({ ...DEFAULT_COMBO_FORM_VALUES })
    }
    return () => {
      active = false
    }
  }, [open, isUpdate, currentRow, form, t])

  const onSubmit = async (data: ComboFormValues) => {
    setIsSubmitting(true)
    try {
      const payload = data
      if (payload.strategy !== 'weighted') {
        payload.weights = undefined
      }
      if (isUpdate && currentRow) {
        await updateCombo(currentRow.id, payload as ComboFormData)
        toast.success(t(SUCCESS_MESSAGES.COMBO_UPDATED))
      } else {
        await createCombo(payload as ComboFormData)
        toast.success(t(SUCCESS_MESSAGES.COMBO_CREATED))
      }
      onOpenChange(false)
      triggerRefresh()
    } catch {
      toast.error(t(ERROR_MESSAGES.UNEXPECTED))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className={cn(sideDrawerFormClassName(), 'sm:max-w-md')}>
        <SheetHeader className={sideDrawerHeaderClassName}>
          <SheetTitle>{isUpdate ? t('Edit Combo') : t('Create Combo')}</SheetTitle>
          <SheetDescription>
            {isUpdate
              ? t('Update combo configuration')
              : t('Create a new combo')}
          </SheetDescription>
        </SheetHeader>

        <div className={cn('px-4', sideDrawerContentClassName())}>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
              <FormField
                control={form.control}
                name='name'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Name')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('combo-name')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='models'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Models')}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder='gpt-4, claude-3, gemini-pro'
                        className='resize-none'
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('Comma-separated model names')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='strategy'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Strategy')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('Select strategy')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value='fallback'>
                          {t('Fallback')}
                        </SelectItem>
                        <SelectItem value='random'>{t('Random')}</SelectItem>
                        <SelectItem value='weighted'>
                          {t('Weighted')}
                        </SelectItem>
                        <SelectItem value='round_robin'>
                          {t('Round Robin')}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {showWeights && (
                <FormField
                  control={form.control}
                  name='weights'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Weights')}</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder='{"gpt-4": 3, "claude-3": 2}'
                          className='resize-none'
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        {t('JSON map of model weights')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name='status'
                render={({ field }) => (
                  <FormItem
                    className={cn(
                      sideDrawerSwitchItemClassName,
                      'flex items-center justify-between rounded-lg border p-3'
                    )}
                  >
                    <div className='space-y-0.5'>
                      <FormLabel>{t('Status')}</FormLabel>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value === 1}
                        onCheckedChange={(checked) =>
                          field.onChange(checked ? 1 : 0)
                        }
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <SheetFooter className={sideDrawerFooterClassName()}>
                <SheetClose
                  render={
                    <Button type='button' variant='outline'>
                      {t('Cancel')}
                    </Button>
                  }
                />
                <Button type='submit' disabled={isSubmitting}>
                  {isSubmitting
                    ? t('Saving...')
                    : isUpdate
                      ? t('Save Changes')
                      : t('Create')}
                </Button>
              </SheetFooter>
            </form>
          </Form>
        </div>
      </SheetContent>
    </Sheet>
  )
}
