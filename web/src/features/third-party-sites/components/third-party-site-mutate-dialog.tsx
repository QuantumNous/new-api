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
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { handleServerError } from '@/lib/handle-server-error'
import {
  createServerError,
  getServerErrorMessage,
} from '@/lib/server-error-message'

import { createThirdPartySite, updateThirdPartySite } from '../api'
import {
  SUCCESS_MESSAGES,
  THIRD_PARTY_SITES_QUERY_KEY,
  THIRD_PARTY_SITE_TYPE_OPTIONS,
} from '../constants'
import {
  getThirdPartySiteFormSchema,
  THIRD_PARTY_SITE_FORM_DEFAULTS,
  toThirdPartySiteFormValues,
  toThirdPartySitePayload,
  type ThirdPartySiteFormMode,
  type ThirdPartySiteFormValues,
} from '../lib/third-party-site-form'
import type { ThirdPartySite } from '../types'

type ThirdPartySiteMutateDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow?: ThirdPartySite
}

const FORM_ID = 'third-party-site-form'

function isFormField(value: unknown): value is keyof ThirdPartySiteFormValues {
  return (
    typeof value === 'string' &&
    Object.hasOwn(THIRD_PARTY_SITE_FORM_DEFAULTS, value)
  )
}

export function ThirdPartySiteMutateDialog(
  props: ThirdPartySiteMutateDialogProps
) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const mode: ThirdPartySiteFormMode = props.currentRow ? 'update' : 'create'

  const schema = useMemo(() => getThirdPartySiteFormSchema(t, mode), [t, mode])
  const form = useForm<ThirdPartySiteFormValues>({
    resolver: zodResolver(schema),
    defaultValues: THIRD_PARTY_SITE_FORM_DEFAULTS,
  })

  useEffect(() => {
    if (!props.open) {
      form.reset(THIRD_PARTY_SITE_FORM_DEFAULTS)
      return
    }
    form.reset(
      props.currentRow
        ? toThirdPartySiteFormValues(props.currentRow)
        : THIRD_PARTY_SITE_FORM_DEFAULTS
    )
  }, [props.open, props.currentRow, form])

  const typeItems = THIRD_PARTY_SITE_TYPE_OPTIONS.map((option) => ({
    value: option.value,
    label: t(option.labelKey),
  }))

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = toThirdPartySitePayload(form.getValues(), mode)
      let res
      try {
        res = props.currentRow
          ? await updateThirdPartySite(props.currentRow.id, payload)
          : await createThirdPartySite(payload)
      } catch (error) {
        // The original error can carry the request body (with the ApiKey) in its
        // config, and the MutationCache keeps the thrown error.
        throw createServerError(
          isAxiosError(error) ? error.response?.data : undefined,
          getServerErrorMessage(error)
        )
      }
      if (!res.success) throw createServerError(res)
      return res
    },
    onSuccess: () => {
      toast.success(
        t(
          mode === 'update'
            ? SUCCESS_MESSAGES.SITE_UPDATED
            : SUCCESS_MESSAGES.SITE_CREATED
        )
      )
      void queryClient.invalidateQueries({
        queryKey: THIRD_PARTY_SITES_QUERY_KEY,
      })
      props.onOpenChange(false)
    },
    onError: (error: Error) => {
      const field = (error.cause as { field?: unknown } | undefined)?.field
      if (isFormField(field)) {
        form.setError(field, { message: error.message })
        return
      }
      handleServerError(error)
    },
  })

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={mode === 'update' ? t('Edit Site') : t('Add Site')}
      footer={
        <>
          <Button
            type='button'
            variant='outline'
            onClick={() => props.onOpenChange(false)}
          >
            {t('Cancel')}
          </Button>
          <Button type='submit' form={FORM_ID} disabled={mutation.isPending}>
            {mutation.isPending ? t('Saving...') : t('Save')}
          </Button>
        </>
      }
    >
      <Form {...form}>
        <form
          id={FORM_ID}
          onSubmit={form.handleSubmit(() => mutation.mutate())}
          className='space-y-4'
        >
          <FormField
            control={form.control}
            name='name'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Name')}</FormLabel>
                <FormControl>
                  <Input {...field} autoComplete='off' />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='type'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Type')}</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  items={typeItems}
                >
                  <FormControl>
                    <SelectTrigger className='w-full'>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {typeItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
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
            name='base_url'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Site Base URL')}</FormLabel>
                <FormControl>
                  <Input {...field} placeholder='https://' autoComplete='off' />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='remote_user_id'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Remote User ID')}</FormLabel>
                <FormControl>
                  <Input {...field} inputMode='numeric' autoComplete='off' />
                </FormControl>
                <FormDescription>
                  {t('User ID of the administrator account on the remote site')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='api_key'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('ApiKey')}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    autoComplete='off'
                    spellCheck={false}
                    autoCapitalize='off'
                    autoCorrect='off'
                    placeholder={
                      mode === 'update'
                        ? t('Leave empty to keep unchanged')
                        : undefined
                    }
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'Access token of the remote administrator account, not an sk- API key'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='receivable_discount'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Receivable Discount')}</FormLabel>
                <FormControl>
                  <Input {...field} inputMode='decimal' autoComplete='off' />
                </FormControl>
                <FormDescription>
                  {t(
                    'Between 0 and 1. For example, 0.85 means 85% of the list price'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>
    </Dialog>
  )
}
