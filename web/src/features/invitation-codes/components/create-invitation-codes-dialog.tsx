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
import { useMutation } from '@tanstack/react-query'
import type { TFunction } from 'i18next'
import { Loader2 } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'

import { DateTimePicker } from '@/components/datetime-picker'
import { Dialog } from '@/components/dialog'
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

import { createInvitationCodes } from '../api'

function getCreateInvitationCodesSchema(t: TFunction) {
  return z.object({
    name: z
      .string()
      .trim()
      .min(1, t('Please enter a name'))
      .max(
        20,
        t('Name must be between {{min}} and {{max}} characters', {
          min: 1,
          max: 20,
        })
      ),
    count: z
      .number()
      .int()
      .min(
        1,
        t('Count must be between {{min}} and {{max}}', { min: 1, max: 100 })
      )
      .max(
        100,
        t('Count must be between {{min}} and {{max}}', { min: 1, max: 100 })
      ),
    expiresAt: z
      .date()
      .optional()
      .refine((value) => !value || value.getTime() > Date.now(), {
        message: t('Expiration time must be in the future'),
      }),
  })
}

type CreateInvitationCodesValues = {
  name: string
  count: number
  expiresAt?: Date
}

type CreateInvitationCodesDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (codes: string[]) => void
}

export function CreateInvitationCodesDialog(
  props: CreateInvitationCodesDialogProps
) {
  const { t } = useTranslation()
  const schema = useMemo(() => getCreateInvitationCodesSchema(t), [t])
  const form = useForm<CreateInvitationCodesValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', count: 1, expiresAt: undefined },
  })
  const mutation = useMutation({ mutationFn: createInvitationCodes })

  useEffect(() => {
    if (props.open) {
      form.reset({ name: '', count: 1, expiresAt: undefined })
    }
  }, [form, props.open])

  const onSubmit = async (values: CreateInvitationCodesValues) => {
    try {
      const result = await mutation.mutateAsync({
        name: values.name.trim(),
        count: values.count,
        expired_time: values.expiresAt
          ? Math.floor(values.expiresAt.getTime() / 1000)
          : 0,
      })
      if (!result.success || !result.data) {
        toast.error(result.message || t('Failed to create invitation codes'))
        return
      }
      toast.success(
        t('Created {{count}} invitation codes', { count: result.data.length })
      )
      props.onCreated(result.data)
    } catch {
      // The shared API interceptor displays transport errors.
    }
  }

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={t('Generate invitation codes')}
      description={t('Create one-time codes for new account registration')}
      contentClassName='max-w-lg'
      bodyClassName='space-y-4'
      footer={
        <>
          <Button
            type='button'
            variant='outline'
            onClick={() => props.onOpenChange(false)}
            disabled={mutation.isPending}
          >
            {t('Cancel')}
          </Button>
          <Button
            type='submit'
            form='create-invitation-codes-form'
            disabled={mutation.isPending}
            className='gap-2'
          >
            {mutation.isPending ? (
              <Loader2 className='size-4 animate-spin' />
            ) : null}
            {t('Generate')}
          </Button>
        </>
      }
    >
      <Form {...form}>
        <form
          id='create-invitation-codes-form'
          onSubmit={form.handleSubmit(onSubmit)}
          className='grid gap-4'
        >
          <FormField
            control={form.control}
            name='name'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Name')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t('Invitation batch name')}
                    maxLength={20}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='count'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Quantity')}</FormLabel>
                <FormControl>
                  <Input
                    type='number'
                    min={1}
                    max={100}
                    value={field.value}
                    onBlur={field.onBlur}
                    onChange={(event) =>
                      field.onChange(Number(event.target.value))
                    }
                  />
                </FormControl>
                <FormDescription>
                  {t('Generate between 1 and 100 codes')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='expiresAt'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Expiration time')}</FormLabel>
                <FormControl>
                  <DateTimePicker
                    value={field.value}
                    onChange={field.onChange}
                    placeholder={t('Never expires')}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>
    </Dialog>
  )
}
