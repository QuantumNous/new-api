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
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'

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
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { updateAgentDailyLimit } from '@/features/agents/api'
import type { AdminAgent } from '@/features/agents/types'

import { getAgentAdminInvalidationPlan } from '../lib/admin'

const formSchema = z.object({ daily_code_limit: z.number().int().positive() })
type FormValues = z.infer<typeof formSchema>

type AgentLimitDialogProps = {
  agent: AdminAgent
  scope: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AgentLimitDialog(props: AgentLimitDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { daily_code_limit: props.agent.daily_code_limit },
  })
  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const response = await updateAgentDailyLimit(props.agent.user_id, values)
      if (!response.success) throw new Error(response.message)
      return response.data
    },
    onSuccess: async () => {
      toast.success(t('Agent daily limit updated'))
      await Promise.all(
        getAgentAdminInvalidationPlan(
          'limit',
          props.scope,
          props.agent.user_id
        ).map((queryKey) => queryClient.invalidateQueries({ queryKey }))
      )
      props.onOpenChange(false)
    },
    onError: () => toast.error(t('Failed to update agent daily limit')),
  })

  const close = (open: boolean) => {
    if (mutation.isPending) return
    if (!open) {
      form.reset({ daily_code_limit: props.agent.daily_code_limit })
      mutation.reset()
    }
    props.onOpenChange(open)
  }

  return (
    <Dialog open={props.open} onOpenChange={close}>
      <DialogContent
        className='sm:max-w-md'
        showCloseButton={!mutation.isPending}
      >
        <DialogHeader>
          <DialogTitle>{t('Change daily code limit')}</DialogTitle>
          <DialogDescription>
            {t(
              'Set the maximum number of package codes this agent can purchase per day.'
            )}
          </DialogDescription>
        </DialogHeader>
        <form
          id='agent-limit-form'
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        >
          <FieldGroup>
            <Field
              data-invalid={Boolean(form.formState.errors.daily_code_limit)}
            >
              <FieldLabel htmlFor='agent-daily-code-limit'>
                {t('Daily code limit')}
              </FieldLabel>
              <Input
                id='agent-daily-code-limit'
                type='number'
                min={1}
                step={1}
                aria-invalid={Boolean(form.formState.errors.daily_code_limit)}
                {...form.register('daily_code_limit', { valueAsNumber: true })}
              />
              <FieldError>
                {form.formState.errors.daily_code_limit
                  ? t('Enter a positive whole number.')
                  : null}
              </FieldError>
            </Field>
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button
            type='button'
            variant='outline'
            disabled={mutation.isPending}
            onClick={() => close(false)}
          >
            {t('Cancel')}
          </Button>
          <Button
            type='submit'
            form='agent-limit-form'
            disabled={mutation.isPending}
          >
            {mutation.isPending && <Spinner data-icon='inline-start' />}
            {mutation.isError ? t('Retry update') : t('Update limit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
