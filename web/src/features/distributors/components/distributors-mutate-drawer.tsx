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

import { createDistributor, updateDistributor } from '../api'
import {
  SUCCESS_MESSAGES,
  getDistributorStatusOptions,
  getDistributorTierOptions,
} from '../constants'
import {
  DISTRIBUTOR_FORM_DEFAULT_VALUES,
  type DistributorFormValues,
  getDistributorFormSchema,
  transformDistributorToFormDefaults,
  transformFormDataToPayload,
  transformFormDataToUpdatePayload,
} from '../lib'
import type { Distributor } from '../types'
import { useDistributors } from './distributors-provider'

type DistributorsMutateDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow?: Distributor
}

export function DistributorsMutateDrawer({
  open,
  onOpenChange,
  currentRow,
}: DistributorsMutateDrawerProps) {
  const { t } = useTranslation()
  const isUpdate = !!currentRow
  const { triggerRefresh } = useDistributors()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<DistributorFormValues>({
    resolver: zodResolver(getDistributorFormSchema(t)),
    defaultValues: DISTRIBUTOR_FORM_DEFAULT_VALUES,
  })

  useEffect(() => {
    if (open && isUpdate && currentRow) {
      form.reset(transformDistributorToFormDefaults(currentRow))
    } else if (open && !isUpdate) {
      form.reset(DISTRIBUTOR_FORM_DEFAULT_VALUES)
    }
  }, [open, isUpdate, currentRow, form])

  const onSubmit = async (data: DistributorFormValues) => {
    setIsSubmitting(true)
    try {
      if (isUpdate && currentRow) {
        const result = await updateDistributor(
          currentRow.id,
          transformFormDataToUpdatePayload(data)
        )
        if (result.success) {
          toast.success(t(SUCCESS_MESSAGES.DISTRIBUTOR_UPDATED))
          onOpenChange(false)
          triggerRefresh()
        }
      } else {
        const result = await createDistributor(transformFormDataToPayload(data))
        if (result.success) {
          toast.success(t(SUCCESS_MESSAGES.DISTRIBUTOR_CREATED))
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

  const tierOptions = getDistributorTierOptions(t)
  const statusOptions = getDistributorStatusOptions(t)

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
            {isUpdate ? t('Update Distributor') : t('Create Distributor')}
          </SheetTitle>
          <SheetDescription>
            {isUpdate
              ? t('Update the distributor by providing necessary info.')
              : t('Add a new distributor by providing necessary info.')}{' '}
            {t('Click save when you are done.')}
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form
            id='distributor-form'
            onSubmit={handleSubmit}
            className={sideDrawerFormClassName()}
          >
            <SideDrawerSection>
              <FormField
                control={form.control}
                name='name'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Name')}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={t('Distributor name')} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='user_id'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Owner User ID')}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type='number'
                        disabled={isUpdate}
                        onChange={(e) =>
                          field.onChange(
                            Number.parseInt(e.target.value, 10) || 0
                          )
                        }
                      />
                    </FormControl>
                    <FormDescription>
                      {isUpdate
                        ? t('The owner account cannot be changed')
                        : t('The user account that manages this distributor')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='tier'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Tier')}</FormLabel>
                    <Select
                      items={tierOptions}
                      onValueChange={(v) => field.onChange(String(v))}
                      value={field.value || ''}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('Select a tier')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent alignItemWithTrigger={false}>
                        <SelectGroup>
                          {tierOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='commission_rate'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Commission Rate')}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type='number'
                        onChange={(e) =>
                          field.onChange(
                            Number.parseInt(e.target.value, 10) || 0
                          )
                        }
                      />
                    </FormControl>
                    <FormDescription>
                      {t('Commission percentage (0-100)')}
                    </FormDescription>
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
                      items={statusOptions}
                      onValueChange={(v) =>
                        field.onChange(Number.parseInt(String(v), 10))
                      }
                      value={String(field.value)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('Select a status')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent alignItemWithTrigger={false}>
                        <SelectGroup>
                          {statusOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
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
          <Button form='distributor-form' type='submit' disabled={isSubmitting}>
            {isSubmitting ? t('Saving...') : t('Save changes')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
