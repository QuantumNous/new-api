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
import { type Table } from '@tanstack/react-table'
import { Loader2, Send } from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'

import { sendUserEmail } from '../api'
import {
  type UserEmailFormData,
  userEmailFormSchema,
} from '../lib/user-email-form'
import { type User } from '../types'

interface SendUserEmailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  table: Table<User>
}

const defaultValues: UserEmailFormData = {
  subject: '',
  content: '',
}

export function SendUserEmailDialog(props: SendUserEmailDialogProps) {
  const { t } = useTranslation()
  const form = useForm<UserEmailFormData>({
    resolver: zodResolver(userEmailFormSchema),
    defaultValues,
  })
  const selectedRows = props.table.getFilteredSelectedRowModel().rows

  const handleOpenChange = (open: boolean) => {
    if (form.formState.isSubmitting) return
    if (!open) form.reset(defaultValues)
    props.onOpenChange(open)
  }

  const handleSubmit = async (values: UserEmailFormData) => {
    const userIds = selectedRows.map((row) => row.original.id)
    if (userIds.length === 0) return

    try {
      const result = await sendUserEmail({
        user_ids: userIds,
        subject: values.subject,
        content: values.content,
      })
      if (!result.success || !result.data) {
        toast.error(result.message || t('Failed to send email'))
        return
      }

      const deliveryMessage = t(
        'Email delivery finished: {{sent}} sent, {{skipped}} skipped, {{failed}} failed',
        result.data
      )
      if (result.data.failed > 0 || result.data.sent === 0) {
        toast.warning(deliveryMessage)
      } else {
        toast.success(deliveryMessage)
      }
      props.table.resetRowSelection()
      form.reset(defaultValues)
      props.onOpenChange(false)
    } catch {
      toast.error(t('Failed to send email'))
    }
  }

  return (
    <Dialog
      open={props.open}
      onOpenChange={handleOpenChange}
      title={t('Send email')}
      description={t(
        'Email will be sent separately to {{count}} selected user(s). Users without email addresses will be skipped.',
        { count: selectedRows.length }
      )}
      contentHeight='auto'
      bodyClassName='space-y-4'
      footer={
        <>
          <Button
            type='button'
            variant='outline'
            onClick={() => handleOpenChange(false)}
            disabled={form.formState.isSubmitting}
          >
            {t('Cancel')}
          </Button>
          <Button
            type='submit'
            form='send-user-email-form'
            disabled={form.formState.isSubmitting || selectedRows.length === 0}
          >
            {form.formState.isSubmitting ? (
              <Loader2 className='animate-spin' />
            ) : (
              <Send />
            )}
            {form.formState.isSubmitting ? t('Sending...') : t('Send')}
          </Button>
        </>
      }
    >
      <Form {...form}>
        <form
          id='send-user-email-form'
          className='space-y-4'
          onSubmit={form.handleSubmit(handleSubmit)}
        >
          <FormField
            control={form.control}
            name='subject'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Subject')}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    maxLength={200}
                    placeholder={t('Email subject')}
                    autoComplete='off'
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='content'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Message')}</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    maxLength={10000}
                    rows={10}
                    className='min-h-48 resize-y'
                    placeholder={t('Write the email message')}
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
