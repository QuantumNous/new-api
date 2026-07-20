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
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'

import { updateChannelMonitorRatio } from '../api'
import { handleChannelMonitorMutationError } from '../lib/error'
import { formatMonitorRatio } from '../lib/format'
import {
  createChannelRatioSchema,
  type ChannelRatioFormValues,
} from '../lib/schema'
import type { ChannelMonitorItem } from '../types'

type EditChannelRatioDialogProps = {
  channel: ChannelMonitorItem
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditChannelRatioDialog(props: EditChannelRatioDialogProps) {
  const queryClient = useQueryClient()
  const schema = createChannelRatioSchema()
  const form = useForm<ChannelRatioFormValues>({
    resolver: zodResolver(schema) as Resolver<ChannelRatioFormValues>,
    defaultValues: {
      ratio: props.channel.ratio ?? 1,
      remark: props.channel.remark ?? '',
    },
  })

  const mutation = useMutation({
    mutationFn: updateChannelMonitorRatio,
    onError: handleChannelMonitorMutationError,
    onSuccess: () => {
      toast.success('上游原始倍率已保存')
      queryClient.invalidateQueries({ queryKey: ['channel-monitor'] })
      queryClient.invalidateQueries({
        queryKey: ['channel-monitor-history', props.channel.id],
      })
      props.onOpenChange(false)
    },
  })

  const handleSubmit = form.handleSubmit((values) => {
    mutation.mutate({
      channelId: props.channel.id,
      ratio: values.ratio,
      remark: values.remark.trim(),
    })
  })

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>修改上游原始倍率</DialogTitle>
          <DialogDescription>
            {props.channel.name} · ID {props.channel.id}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form className='flex flex-col gap-5' onSubmit={handleSubmit}>
            <FormField
              control={form.control}
              name='ratio'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>上游原始倍率</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      min={0}
                      max={1_000_000}
                      step='0.000001'
                      value={field.value}
                      onBlur={field.onBlur}
                      onChange={field.onChange}
                      name={field.name}
                      ref={field.ref}
                    />
                  </FormControl>
                  <FormDescription>
                    {props.channel.ratio == null
                      ? '首次记录将作为基准值'
                      : `当前记录：${formatMonitorRatio(props.channel.ratio)}`}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='remark'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>备注</FormLabel>
                  <FormControl>
                    <Textarea placeholder='选填' maxLength={255} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className='flex justify-end gap-2'>
              <Button
                type='button'
                variant='outline'
                onClick={() => props.onOpenChange(false)}
                disabled={mutation.isPending}
              >
                取消
              </Button>
              <Button type='submit' disabled={mutation.isPending}>
                {mutation.isPending && <Spinner data-icon='inline-start' />}
                保存
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
