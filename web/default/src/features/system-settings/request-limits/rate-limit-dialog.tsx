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
import { useEffect } from 'react'
import * as z from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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

const parseOptionalInt = (value: string, fallback: number) =>
  value === '' ? undefined : parseInt(value) || fallback

const rateLimitDialogSchema = z
  .object({
    groupName: z.string().min(1, 'Group name is required'),
    maxRequests: z
      .number()
      .min(0, 'Must be >= 0')
      .max(2147483647, 'Must be <= 2,147,483,647')
      .optional(),
    maxSuccess: z
      .number()
      .min(1, 'Must be >= 1')
      .max(2147483647, 'Must be <= 2,147,483,647')
      .optional(),
    maxConcurrent: z
      .number()
      .min(0, 'Must be >= 0')
      .max(2147483647, 'Must be <= 2,147,483,647')
      .optional(),
  })
  .superRefine((data, ctx) => {
    const hasRateLimit =
      data.maxRequests !== undefined || data.maxSuccess !== undefined

    if (hasRateLimit) {
      if (data.maxRequests === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['maxRequests'],
          message: 'Required when successful request limit is set',
        })
      }
      if (data.maxSuccess === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['maxSuccess'],
          message: 'Required when total request limit is set',
        })
      }
    }

    if (!hasRateLimit && data.maxConcurrent === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['maxConcurrent'],
        message: 'Set at least one group limit',
      })
    }
  })

type RateLimitDialogFormValues = z.infer<typeof rateLimitDialogSchema>

export type RateLimitEntryData = {
  groupName: string
  maxRequests?: number
  maxSuccess?: number
  maxConcurrent?: number
}

type RateLimitDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (data: RateLimitEntryData) => void
  editData?: RateLimitEntryData | null
}

export function RateLimitDialog({
  open,
  onOpenChange,
  onSave,
  editData,
}: RateLimitDialogProps) {
  const { t } = useTranslation()
  const isEditMode = !!editData

  const form = useForm<RateLimitDialogFormValues>({
    resolver: zodResolver(rateLimitDialogSchema),
    defaultValues: {
      groupName: '',
      maxRequests: undefined,
      maxSuccess: undefined,
      maxConcurrent: undefined,
    },
  })

  useEffect(() => {
    if (editData) {
      form.reset(editData)
    } else {
      form.reset({
        groupName: '',
        maxRequests: undefined,
        maxSuccess: undefined,
        maxConcurrent: undefined,
      })
    }
  }, [editData, form, open])

  const handleSubmit = (values: RateLimitDialogFormValues) => {
    onSave(values)
    form.reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[500px]'>
        <DialogHeader>
          <DialogTitle>
            {isEditMode
              ? t('Edit group request limits')
              : t('Add group request limits')}
          </DialogTitle>
          <DialogDescription>
            {t('Configure rate and concurrency limits for a specific user group.')}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className='space-y-4'
          >
            <FormField
              control={form.control}
              name='groupName'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Group Name')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('e.g., default, vip, premium')}
                      {...field}
                      disabled={isEditMode}
                    />
                  </FormControl>
                  <FormDescription>
                    {isEditMode
                      ? t('Group name cannot be changed when editing.')
                      : t('Unique identifier for this group.')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='maxRequests'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t('Max Requests (including failures)')}
                  </FormLabel>
                  <FormControl>
                    <div className='flex items-center gap-2'>
                      <Input
                        type='number'
                        min={0}
                        max={2147483647}
                        step={1}
                        value={field.value ?? ''}
                        onChange={(e) =>
                          field.onChange(parseOptionalInt(e.target.value, 0))
                        }
                      />
                      <span className='text-muted-foreground text-sm'>
                        {t('times')}
                      </span>
                    </div>
                  </FormControl>
                  <FormDescription>
                    {t('Leave blank to use the global rate limit for this group. 0 = unlimited.')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='maxSuccess'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Max Successful Requests')}</FormLabel>
                  <FormControl>
                    <div className='flex items-center gap-2'>
                      <Input
                        type='number'
                        min={1}
                        max={2147483647}
                        step={1}
                        value={field.value ?? ''}
                        onChange={(e) =>
                          field.onChange(parseOptionalInt(e.target.value, 1))
                        }
                      />
                      <span className='text-muted-foreground text-sm'>
                        {t('times')}
                      </span>
                    </div>
                  </FormControl>
                  <FormDescription>
                    {t('Required when total request limit is set.')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='maxConcurrent'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Max concurrent requests')}</FormLabel>
                  <FormControl>
                    <div className='flex items-center gap-2'>
                      <Input
                        type='number'
                        min={0}
                        max={2147483647}
                        step={1}
                        value={field.value ?? ''}
                        onChange={(e) =>
                          field.onChange(parseOptionalInt(e.target.value, 0))
                        }
                      />
                      <span className='text-muted-foreground text-sm'>
                        {t('requests')}
                      </span>
                    </div>
                  </FormControl>
                  <FormDescription>
                    {t('Concurrent in-flight model requests per user, 0 = unlimited')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                onClick={() => onOpenChange(false)}
              >
                {t('Cancel')}
              </Button>
              <Button type='submit'>
                {isEditMode ? t('Update') : t('Add')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
