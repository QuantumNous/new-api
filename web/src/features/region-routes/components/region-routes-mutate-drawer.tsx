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
import { zodResolver } from '@hookform/resolvers/zod'
import { type FormEvent, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  SideDrawerSection,
  sideDrawerContentClassName,
  sideDrawerFooterClassName,
  sideDrawerFormClassName,
  sideDrawerHeaderClassName,
  sideDrawerSwitchItemClassName,
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
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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

import {
  createRegionRoute,
  getRegionRoute,
  updateRegionRoute,
} from '../api'
import {
  SUCCESS_MESSAGES,
  getRegionRouteStrategyOptions,
} from '../constants'
import {
  getRegionRouteFormSchema,
  type RegionRouteFormValues,
  REGION_ROUTE_FORM_DEFAULT_VALUES,
  transformFormDataToPayload,
  transformRegionRouteToFormDefaults,
} from '../lib'
import type { RegionRoute } from '../types'
import { useRegionRoutes } from './region-routes-provider'
import { ChannelMultiSelect } from './channel-multi-select'

type RegionRoutesMutateDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow?: RegionRoute
}

export function RegionRoutesMutateDrawer({
  open,
  onOpenChange,
  currentRow,
}: RegionRoutesMutateDrawerProps) {
  const { t } = useTranslation()
  const isUpdate = !!currentRow
  const { triggerRefresh } = useRegionRoutes()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<RegionRouteFormValues>({
    resolver: zodResolver(getRegionRouteFormSchema(t)),
    defaultValues: REGION_ROUTE_FORM_DEFAULT_VALUES,
  })

  useEffect(() => {
    if (open && isUpdate && currentRow) {
      getRegionRoute(currentRow.id)
        .then((result) => {
          if (result.success && result.data) {
            form.reset(transformRegionRouteToFormDefaults(result.data))
          }
        })
        .catch(() => {})
    } else if (open && !isUpdate) {
      form.reset(REGION_ROUTE_FORM_DEFAULT_VALUES)
    }
  }, [open, isUpdate, currentRow, form])

  const onSubmit = async (data: RegionRouteFormValues) => {
    setIsSubmitting(true)
    try {
      const payload = transformFormDataToPayload(data)
      if (isUpdate && currentRow) {
        const result = await updateRegionRoute(currentRow.id, payload)
        if (result.success) {
          toast.success(t(SUCCESS_MESSAGES.REGION_ROUTE_UPDATED))
          onOpenChange(false)
          triggerRefresh()
        }
      } else {
        const result = await createRegionRoute(payload)
        if (result.success) {
          toast.success(t(SUCCESS_MESSAGES.REGION_ROUTE_CREATED))
          onOpenChange(false)
          triggerRefresh()
        }
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    void form.handleSubmit(onSubmit)(event)
  }

  const strategyOptions = getRegionRouteStrategyOptions(t)

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
      <SheetContent className={sideDrawerContentClassName('sm:max-w-[600px]')}>
        <SheetHeader className={sideDrawerHeaderClassName()}>
          <SheetTitle>
            {isUpdate
              ? t('Update Region Route')
              : t('Create Region Route')}
          </SheetTitle>
          <SheetDescription>
            {isUpdate
              ? t('Update the region route by providing necessary info.')
              : t(
                  'Add a new region route by providing necessary info.'
                )}{' '}
            {t('Click save when you are done.')}
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form
            id='region-route-form'
            onSubmit={handleSubmit}
            className={sideDrawerFormClassName()}
          >
            <SideDrawerSection>
              <FormField
                control={form.control}
                name='region'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Region')}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder={t('e.g. cn, us, eu, global')}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('Region identifier declared by the X-Region header')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='model'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Model')}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder={t('Model name, or empty for all models')}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('Leave empty to match all models (*)')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='channel_ids'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Channels')}</FormLabel>
                    <FormControl>
                      <ChannelMultiSelect
                        value={(field.value as number[]) ?? []}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('Select channels directly, or use a tag below')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='tag'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Tag')}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder={t('Channel tag (optional)')}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('Match channels by tag instead of explicit ids')}
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
                    <Select
                      items={strategyOptions.map((opt) => ({
                        value: opt.value,
                        label: opt.label,
                      }))}
                      onValueChange={(v) => field.onChange(String(v))}
                      value={field.value || ''}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={t('Select a strategy')}
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent alignItemWithTrigger={false}>
                        <SelectGroup>
                          {strategyOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {t('How to rank candidate channels for this route')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className='grid grid-cols-2 gap-4'>
                <FormField
                  control={form.control}
                  name='priority'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Priority')}</FormLabel>
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

                <FormField
                  control={form.control}
                  name='weight'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Weight')}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type='number'
                          onChange={(e) =>
                            field.onChange(Number.parseInt(e.target.value, 10) || 1)
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
                name='enabled'
                render={({ field }) => (
                  <FormItem className={sideDrawerSwitchItemClassName()}>
                    <FormLabel className='!mt-0'>{t('Enabled Status')}</FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
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
            form='region-route-form'
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
