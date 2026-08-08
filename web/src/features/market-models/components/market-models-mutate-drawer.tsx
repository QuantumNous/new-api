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
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  SideDrawerSection,
  sideDrawerContentClassName,
  sideDrawerFooterClassName,
  sideDrawerFormClassName,
  sideDrawerHeaderClassName,
} from '@/components/drawer-layout'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

import { createMarketModel, getMarketModel, updateMarketModel } from '../api'
import {
  SUCCESS_MESSAGES,
  getMarketModelCurrencyOptions,
  getMarketModelStatusOptions,
  getMarketModelUnitOptions,
} from '../constants'
import {
  type MarketModelFormValues,
  MARKET_MODEL_FORM_DEFAULT_VALUES,
  getMarketModelFormSchema,
  transformFormDataToPayload,
  transformMarketModelToFormDefaults,
} from '../lib/market-model-form'
import type { MarketModel } from '../types'
import { useMarketModels } from './market-models-provider'

type MarketModelsMutateDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow?: MarketModel
}

export function MarketModelsMutateDrawer({
  open,
  onOpenChange,
  currentRow,
}: MarketModelsMutateDrawerProps) {
  const { t } = useTranslation()
  const isUpdate = !!currentRow
  const { triggerRefresh } = useMarketModels()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<MarketModelFormValues>({
    resolver: zodResolver(getMarketModelFormSchema(t)),
    defaultValues: MARKET_MODEL_FORM_DEFAULT_VALUES,
  })

  // Load existing data when updating
  useEffect(() => {
    if (open && isUpdate && currentRow) {
      getMarketModel(currentRow.id)
        .then((result) => {
          if (result.success && result.data) {
            form.reset(transformMarketModelToFormDefaults(result.data))
          }
        })
        .catch(() => {})
    } else if (open && !isUpdate) {
      form.reset(MARKET_MODEL_FORM_DEFAULT_VALUES)
    }
  }, [open, isUpdate, currentRow, form])

  const onSubmit = async (data: MarketModelFormValues) => {
    setIsSubmitting(true)
    try {
      const payload = transformFormDataToPayload(data)

      const result = isUpdate && currentRow
        ? await updateMarketModel({ ...payload, id: currentRow.id })
        : await createMarketModel(payload)

      if (result.success) {
        toast.success(
          t(
            isUpdate
              ? SUCCESS_MESSAGES.MARKET_MODEL_UPDATED
              : SUCCESS_MESSAGES.MARKET_MODEL_CREATED
          )
        )
        onOpenChange(false)
        triggerRefresh()
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const statusOptions = getMarketModelStatusOptions(t)
  const unitOptions = getMarketModelUnitOptions(t)
  const currencyOptions = getMarketModelCurrencyOptions(t)

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
      <SheetContent className={sideDrawerContentClassName('sm:max-w-[640px]')}>
        <SheetHeader className={sideDrawerHeaderClassName()}>
          <SheetTitle>
            {isUpdate
              ? t('Update Model Market Item')
              : t('Create Model Market Item')}
          </SheetTitle>
          <SheetDescription>
            {isUpdate
              ? t('Update the model market item by providing necessary info.')
              : t('Add a new model market item by providing necessary info.')}{' '}
            {t('Click save when you are done.')}
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form
            id='market-model-form'
            onSubmit={form.handleSubmit(onSubmit)}
            className={sideDrawerFormClassName()}
          >
            <SideDrawerSection>
              <FormField
                control={form.control}
                name='model'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Model')}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        disabled={isUpdate}
                        placeholder={t('e.g. gpt-4o')}
                      />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'Actual model name, must match a routable model (Pricing.ModelName). Cannot be changed after creation.'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='provider'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Provider')}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={t('e.g. OpenAI')} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='category'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Category')}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={t('e.g. LLM')} />
                    </FormControl>
                    <FormDescription>
                      {t('Maps to a PublicModelCategory.')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='tags'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Tags')}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder={t('e.g. vision,reasoning')}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className='grid grid-cols-2 gap-4'>
                <FormField
                  control={form.control}
                  name='input_price'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Input Price (minor / 1M)')}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type='number'
                          min='0'
                          onChange={(e) =>
                            field.onChange(Number.parseInt(e.target.value, 10) || 0)
                          }
                        />
                      </FormControl>
                      <FormDescription>
                        {t(
                          'Integer minor units (e.g. fen for CNY) per 1M units.'
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='output_price'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Output Price (minor / 1M)')}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type='number'
                          min='0'
                          onChange={(e) =>
                            field.onChange(Number.parseInt(e.target.value, 10) || 0)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className='grid grid-cols-3 gap-4'>
                <FormField
                  control={form.control}
                  name='currency'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Currency')}</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('Currency')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {currencyOptions.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='unit'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Unit')}</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('Unit')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {unitOptions.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='status'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Status')}</FormLabel>
                      <Select
                        value={String(field.value)}
                        onValueChange={(v) =>
                          field.onChange(v ? Number.parseInt(v, 10) : 1)
                        }
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('Status')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {statusOptions.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className='grid grid-cols-2 gap-4'>
                <FormField
                  control={form.control}
                  name='trial_quota'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Trial Quota')}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type='number'
                          min='0'
                          onChange={(e) =>
                            field.onChange(Number.parseInt(e.target.value, 10) || 0)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='sort'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Sort')}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type='number'
                          onChange={(e) =>
                            field.onChange(Number.parseInt(e.target.value, 10) || 0)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name='featured'
                render={({ field }) => (
                  <FormItem className='flex flex-row items-center justify-between rounded-lg border p-3'>
                    <div className='space-y-0.5'>
                      <FormLabel>{t('Featured')}</FormLabel>
                      <FormDescription>
                        {t('Show this item prominently in the storefront.')}
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='metadata'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Metadata (JSON, i18n)')}</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={5}
                        placeholder={'{\n  "en": { "name": "...", "description": "..." },\n  "zh": { "name": "...", "description": "..." }\n}'}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('Optional per-locale display overrides. Must be valid JSON.')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </SideDrawerSection>
          </form>
        </Form>
        <SheetFooter className={sideDrawerFooterClassName()}>
          <SheetClose render={<Button variant='outline' />}>
            {t('Close')}
          </SheetClose>
          <Button
            form='market-model-form'
            type='submit'
            disabled={isSubmitting}
          >
            {isSubmitting ? t('Saving...') : t('Save changes')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
