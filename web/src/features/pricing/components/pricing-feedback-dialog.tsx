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
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { sendHwPricingFeedback } from '@/features/hw/api'
import { handleServerError } from '@/lib/handle-server-error'

import {
  PRICING_FEEDBACK_DEFAULTS,
  PRICING_FEEDBACK_LIMITS,
  pricingFeedbackSchema,
  type PricingFeedbackValues,
} from '../lib/feedback-schema'

const FORM_ID = 'pricing-feedback-form'

/**
 * Button and dialog on /pricing for "a price is wrong" or "a model is
 * missing". The server stores, mails and bundles every report; the hidden
 * "website" field is a honeypot that only bots fill.
 */
export function PricingFeedbackDialog() {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const form = useForm<PricingFeedbackValues>({
    resolver: zodResolver(pricingFeedbackSchema),
    defaultValues: PRICING_FEEDBACK_DEFAULTS,
  })
  const send = useMutation({
    mutationFn: (values: PricingFeedbackValues) =>
      sendHwPricingFeedback({
        ...values,
        lang: (i18n.resolvedLanguage ?? i18n.language).startsWith('tr')
          ? 'tr'
          : 'en',
      }),
    onSuccess: () => {
      toast.success(t('Thank you, we check every report against the source.'))
      form.reset(PRICING_FEEDBACK_DEFAULTS)
      setOpen(false)
    },
    onError: (error) =>
      handleServerError(error, t('The report could not be sent.')),
  })
  const kind = form.watch('kind')

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!send.isPending) setOpen(next)
      }}
      trigger={
        <Button variant='outline' size='sm'>
          {t('Report a wrong price or missing model')}
        </Button>
      }
      title={t('Report a wrong price or missing model')}
      description={t(
        'We check your report against the official source and fix the price list.'
      )}
      contentClassName='sm:max-w-lg'
      footer={
        <Button type='submit' form={FORM_ID} disabled={send.isPending}>
          {send.isPending ? t('Sending...') : t('Send report')}
        </Button>
      }
    >
      <Form {...form}>
        <form
          id={FORM_ID}
          className='grid gap-4'
          noValidate
          onSubmit={form.handleSubmit((values) => send.mutate(values))}
        >
          <FormField
            control={form.control}
            name='kind'
            render={({ field }) => (
              <FormItem>
                <FormLabel required>{t('What is the problem?')}</FormLabel>
                <FormControl>
                  <NativeSelect className='w-full' {...field}>
                    <NativeSelectOption value='price_wrong'>
                      {t('A price is wrong')}
                    </NativeSelectOption>
                    <NativeSelectOption value='model_missing'>
                      {t('A model is missing')}
                    </NativeSelectOption>
                    <NativeSelectOption value='other'>
                      {t('Something else')}
                    </NativeSelectOption>
                  </NativeSelect>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='model'
            render={({ field }) => (
              <FormItem>
                <FormLabel required={kind !== 'other'}>{t('Model')}</FormLabel>
                <FormControl>
                  <Input
                    maxLength={PRICING_FEEDBACK_LIMITS.model}
                    placeholder='gpt-6-astra'
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='message'
            render={({ field }) => (
              <FormItem>
                <FormLabel required={kind === 'other'}>
                  {t('Explanation')}
                </FormLabel>
                <FormControl>
                  <Textarea
                    rows={4}
                    maxLength={PRICING_FEEDBACK_LIMITS.message}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='source_url'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Official source link (optional)')}</FormLabel>
                <FormControl>
                  <Input
                    type='url'
                    inputMode='url'
                    maxLength={PRICING_FEEDBACK_LIMITS.sourceUrl}
                    placeholder='https://'
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='email'
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {t('Your email for the answer (optional)')}
                </FormLabel>
                <FormControl>
                  <Input
                    type='email'
                    autoComplete='email'
                    maxLength={PRICING_FEEDBACK_LIMITS.email}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div
            aria-hidden='true'
            className='absolute -left-[10000px] h-px w-px overflow-hidden'
          >
            <label htmlFor='pricing-feedback-website'>Website</label>
            <input
              id='pricing-feedback-website'
              tabIndex={-1}
              autoComplete='off'
              {...form.register('website')}
            />
          </div>
        </form>
      </Form>
    </Dialog>
  )
}
