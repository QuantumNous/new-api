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
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { Switch } from '@/components/ui/switch'

import { createAutoGroupRule, updateAutoGroupRule } from '../api'
import { QUERY_KEYS, SUCCESS_MESSAGES } from '../constants'
import { useGroups } from '../hooks/use-groups'
import {
  RULE_FORM_DEFAULT_VALUES,
  getRuleFormSchema,
  transformFormValuesToPayload,
  transformRuleToFormValues,
  type RuleFormValues,
} from '../lib'
import type { AutoGroupRule } from '../types'

type RuleMutateDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow?: AutoGroupRule
}

export function RuleMutateDialog({
  open,
  onOpenChange,
  currentRow,
}: RuleMutateDialogProps) {
  const { t } = useTranslation()
  const isUpdate = !!currentRow
  const queryClient = useQueryClient()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { data: groupsData } = useGroups()
  const groups = groupsData?.data ?? []

  const form = useForm<RuleFormValues>({
    resolver: zodResolver(getRuleFormSchema(t)),
    defaultValues: RULE_FORM_DEFAULT_VALUES,
  })

  // Reset form when opening or when the target row changes.
  useEffect(() => {
    if (!open) return
    if (isUpdate && currentRow) {
      form.reset(transformRuleToFormValues(currentRow))
    } else {
      form.reset(RULE_FORM_DEFAULT_VALUES)
    }
  }, [open, isUpdate, currentRow, form])

  const createMutation = useMutation({
    mutationFn: createAutoGroupRule,
  })
  const updateMutation = useMutation({
    mutationFn: (data: { id: number; payload: RuleFormValues }) =>
      updateAutoGroupRule(data.id, transformFormValuesToPayload(data.payload)),
  })

  const onSubmit = async (values: RuleFormValues) => {
    setIsSubmitting(true)
    try {
      if (isUpdate && currentRow) {
        const result = await updateMutation.mutateAsync({
          id: currentRow.id,
          payload: values,
        })
        if (result.success) {
          toast.success(t(SUCCESS_MESSAGES.RULE_UPDATED))
          onOpenChange(false)
          void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.RULES })
        }
      } else {
        const result = await createMutation.mutateAsync(
          transformFormValuesToPayload(values)
        )
        if (result.success) {
          toast.success(t(SUCCESS_MESSAGES.RULE_CREATED))
          onOpenChange(false)
          void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.RULES })
        }
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v)
        if (!v) form.reset()
      }}
    >
      <DialogContent className='sm:max-w-[480px]'>
        <DialogHeader>
          <DialogTitle>
            {isUpdate ? t('Edit Rule') : t('Create Rule')}
          </DialogTitle>
          <DialogDescription>
            {isUpdate
              ? t('Update the auto group rule mapping.')
              : t('Create a new job title to group mapping rule.')}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            id='auto-group-rule-form'
            onSubmit={form.handleSubmit(onSubmit)}
            className='grid gap-4'
          >
            <FormField
              control={form.control}
              name='job_title'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Job Title')}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder={t('e.g. Software Engineer')}
                    />
                  </FormControl>
                  <FormDescription>
                    {t(
                      'The job title to match. Users with this title will be assigned to the target group.'
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='target_group'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Target Group')}</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(value) =>
                      value !== null && field.onChange(value)
                    }
                  >
                    <FormControl>
                      <SelectTrigger className='w-full'>
                        <SelectValue
                          placeholder={t('Select a group')}
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectGroup>
                        {groups.length === 0 && (
                          <div className='text-muted-foreground px-2 py-1.5 text-sm'>
                            {t('No groups available')}
                          </div>
                        )}
                        {groups.map((group) => (
                          <SelectItem key={group} value={group}>
                            {group}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
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
                        type='number'
                        value={field.value}
                        placeholder='0'
                        onChange={(e) =>
                          field.onChange(Number.parseInt(e.target.value, 10) || 0)
                        }
                      />
                    </FormControl>
                    <FormDescription>
                      {t('Higher priority rules are matched first.')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='enabled'
                render={({ field }) => (
                  <FormItem className='flex flex-row items-center justify-between gap-2 rounded-lg border p-3'>
                    <div className='grid gap-0.5'>
                      <FormLabel>{t('Enabled')}</FormLabel>
                      <FormDescription>
                        {t('Toggle rule active state')}
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
            </div>

            <FormField
              control={form.control}
              name='remark'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Remark')}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder={t('Optional note')}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>

        <DialogFooter>
          <DialogClose render={<Button variant='outline' />}>
            {t('Cancel')}
          </DialogClose>
          <Button
            type='submit'
            form='auto-group-rule-form'
            disabled={isSubmitting}
          >
            {isSubmitting ? t('Saving...') : t('Save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
