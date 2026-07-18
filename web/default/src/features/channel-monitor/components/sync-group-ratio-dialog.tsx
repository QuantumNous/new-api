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
import { useForm, type Resolver } from 'react-hook-form'
import { toast } from 'sonner'

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
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group'
import { Spinner } from '@/components/ui/spinner'
import { CHANNEL_STATUS } from '@/features/channels/constants'

import { syncChannelMonitorGroupRatio } from '../api'
import { formatMonitorRatio } from '../lib/format'
import {
  createGroupRatioSyncSchema,
  MAX_MONITOR_RATIO,
  type GroupRatioSyncFormValues,
} from '../lib/schema'
import type { GroupMonitorItem } from '../types'

type SyncGroupRatioDialogProps = {
  group: GroupMonitorItem
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SyncGroupRatioDialog(props: SyncGroupRatioDialogProps) {
  const queryClient = useQueryClient()
  let highestUpstreamRatio: number | null = null
  for (const channel of props.group.channels) {
    if (channel.status !== CHANNEL_STATUS.ENABLED || channel.ratio == null) {
      continue
    }
    if (highestUpstreamRatio == null || channel.ratio > highestUpstreamRatio) {
      highestUpstreamRatio = channel.ratio
    }
  }

  const form = useForm<GroupRatioSyncFormValues>({
    resolver: zodResolver(
      createGroupRatioSyncSchema(highestUpstreamRatio)
    ) as Resolver<GroupRatioSyncFormValues>,
    defaultValues: { coefficient: props.group.coefficient },
  })
  const mutation = useMutation({
    mutationFn: syncChannelMonitorGroupRatio,
    onSuccess: (response) => {
      toast.success(
        `分组倍率已更新为 ${formatMonitorRatio(response.data.ratio)}`
      )
      queryClient.invalidateQueries({ queryKey: ['channel-monitor'] })
      props.onOpenChange(false)
    },
  })
  const coefficient = Number(form.watch('coefficient'))
  const targetRatio =
    highestUpstreamRatio == null || !Number.isFinite(coefficient)
      ? null
      : highestUpstreamRatio * coefficient
  const handleSubmit = form.handleSubmit((values) => {
    mutation.mutate({
      group: props.group.name,
      coefficient: values.coefficient,
    })
  })

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>按最高上游倍率更新</DialogTitle>
          <DialogDescription>{props.group.name}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form className='flex flex-col gap-5' onSubmit={handleSubmit}>
            <div className='bg-muted/40 grid grid-cols-2 gap-4 rounded-md px-3 py-2.5 text-sm'>
              <div className='flex flex-col gap-1'>
                <span className='text-muted-foreground'>最高上游倍率</span>
                <span className='font-mono font-semibold'>
                  {formatMonitorRatio(highestUpstreamRatio)}
                </span>
              </div>
              <div className='flex flex-col gap-1'>
                <span className='text-muted-foreground'>更新后分组倍率</span>
                <span className='font-mono font-semibold'>
                  {formatMonitorRatio(targetRatio)}
                </span>
              </div>
            </div>

            <FormField
              control={form.control}
              name='coefficient'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>系数</FormLabel>
                  <FormControl>
                    <InputGroup>
                      <InputGroupAddon>×</InputGroupAddon>
                      <InputGroupInput
                        type='number'
                        min={0}
                        max={MAX_MONITOR_RATIO}
                        step='any'
                        inputMode='decimal'
                        value={field.value}
                        onBlur={field.onBlur}
                        onChange={field.onChange}
                        name={field.name}
                        ref={field.ref}
                        aria-invalid={Boolean(
                          form.formState.errors.coefficient
                        )}
                      />
                    </InputGroup>
                  </FormControl>
                  <FormDescription>
                    最终分组倍率 = 最高上游倍率 × 系数
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                onClick={() => props.onOpenChange(false)}
                disabled={mutation.isPending}
              >
                取消
              </Button>
              <Button
                type='submit'
                disabled={mutation.isPending || highestUpstreamRatio == null}
              >
                {mutation.isPending && <Spinner data-icon='inline-start' />}
                保存系数并更新
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
