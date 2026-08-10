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

import { DateTimePicker } from '@/components/datetime-picker'
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
import { Textarea } from '@/components/ui/textarea'

import {
  createSlaIncident,
  getSlaIncident,
  updateSlaIncident,
} from '../api'
import {
  SUCCESS_MESSAGES,
  getSlaIncidentSeverityOptions,
  getSlaIncidentStatusOptions,
} from '../constants'
import {
  getSlaIncidentFormSchema,
  type SlaIncidentFormValues,
  SLA_INCIDENT_FORM_DEFAULT_VALUES,
  transformFormDataToPayload,
  transformSlaIncidentToFormDefaults,
} from '../lib'
import type { SlaIncident } from '../types'
import { useSlaIncidents } from './sla-incidents-provider'

type SlaIncidentsMutateDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow?: SlaIncident
}

export function SlaIncidentsMutateDrawer({
  open,
  onOpenChange,
  currentRow,
}: SlaIncidentsMutateDrawerProps) {
  const { t } = useTranslation()
  const isUpdate = !!currentRow
  const { triggerRefresh } = useSlaIncidents()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<SlaIncidentFormValues>({
    resolver: zodResolver(getSlaIncidentFormSchema(t)),
    defaultValues: SLA_INCIDENT_FORM_DEFAULT_VALUES,
  })

  useEffect(() => {
    if (open && isUpdate && currentRow) {
      getSlaIncident(currentRow.id)
        .then((result) => {
          if (result.success && result.data) {
            form.reset(transformSlaIncidentToFormDefaults(result.data))
          }
        })
        .catch(() => {})
    } else if (open && !isUpdate) {
      form.reset(SLA_INCIDENT_FORM_DEFAULT_VALUES)
    }
  }, [open, isUpdate, currentRow, form])

  const onSubmit = async (data: SlaIncidentFormValues) => {
    setIsSubmitting(true)
    try {
      const payload = transformFormDataToPayload(data)
      if (isUpdate && currentRow) {
        const result = await updateSlaIncident(currentRow.id, payload)
        if (result.success) {
          toast.success(t(SUCCESS_MESSAGES.SLA_INCIDENT_UPDATED))
          onOpenChange(false)
          triggerRefresh()
        }
      } else {
        const result = await createSlaIncident(payload)
        if (result.success) {
          toast.success(t(SUCCESS_MESSAGES.SLA_INCIDENT_CREATED))
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

  const statusOptions = getSlaIncidentStatusOptions(t)
  const severityOptions = getSlaIncidentSeverityOptions(t)

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
            {isUpdate ? t('Update SLA Incident') : t('Create SLA Incident')}
          </SheetTitle>
          <SheetDescription>
            {isUpdate
              ? t('Update the SLA incident by providing necessary info.')
              : t('Add a new SLA incident by providing necessary info.')}{' '}
            {t('Click save when you are done.')}
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form
            id='sla-incident-form'
            onSubmit={handleSubmit}
            className={sideDrawerFormClassName()}
          >
            <SideDrawerSection>
              <FormField
                control={form.control}
                name='title'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Title')}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={t('Incident title')} />
                    </FormControl>
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
                        {...field}
                        placeholder={t('What is happening?')}
                        rows={3}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className='grid grid-cols-2 gap-4'>
                <FormField
                  control={form.control}
                  name='status'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Status')}</FormLabel>
                      <Select
                        items={statusOptions.map((opt) => ({
                          value: opt.value,
                          label: opt.label,
                        }))}
                        onValueChange={(v) => field.onChange(Number(v))}
                        value={String(field.value)}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue
                              placeholder={t('Select a status')}
                            />
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

                <FormField
                  control={form.control}
                  name='severity'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Severity')}</FormLabel>
                      <Select
                        items={severityOptions.map((opt) => ({
                          value: opt.value,
                          label: opt.label,
                        }))}
                        onValueChange={(v) => field.onChange(String(v))}
                        value={field.value || ''}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue
                              placeholder={t('Select a severity')}
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent alignItemWithTrigger={false}>
                          <SelectGroup>
                            {severityOptions.map((opt) => (
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
              </div>

              <FormField
                control={form.control}
                name='started_at'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Started At')}</FormLabel>
                    <FormControl>
                      <DateTimePicker
                        value={field.value}
                        onChange={field.onChange}
                        placeholder={t('Select start time')}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('Defaults to now if empty')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='resolved_at'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Resolved At')}</FormLabel>
                    <FormControl>
                      <DateTimePicker
                        value={field.value}
                        onChange={field.onChange}
                        placeholder={t('Not resolved yet')}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('Leave empty while the incident is ongoing')}
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
            form='sla-incident-form'
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
