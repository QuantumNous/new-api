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
import { Refresh01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { toast } from 'sonner'

import { MultiSelect } from '@/components/multi-select'
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
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'

import {
  getChannelMonitorAvailableGroups,
  updateMonitoredChannelGroups,
} from '../api'
import {
  createChannelGroupsSchema,
  type ChannelGroupsFormValues,
} from '../lib/schema'
import type { ChannelMonitorItem } from '../types'

type EditChannelGroupsDialogProps = {
  channel: ChannelMonitorItem
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditChannelGroupsDialog(props: EditChannelGroupsDialogProps) {
  const queryClient = useQueryClient()
  const schema = createChannelGroupsSchema()
  const form = useForm<ChannelGroupsFormValues>({
    resolver: zodResolver(schema) as Resolver<ChannelGroupsFormValues>,
    defaultValues: { groups: props.channel.groups },
  })
  const groupsQuery = useQuery({
    queryKey: ['channel-monitor-available-groups'],
    queryFn: getChannelMonitorAvailableGroups,
    staleTime: 60 * 1000,
  })
  const groupOptions = useMemo(() => {
    const groups = new Set([
      ...props.channel.groups,
      ...(groupsQuery.data?.data ?? []),
    ])
    return [...groups]
      .sort((first, second) => first.localeCompare(second))
      .map((group) => ({ value: group, label: group }))
  }, [groupsQuery.data?.data, props.channel.groups])
  const mutation = useMutation({
    mutationFn: updateMonitoredChannelGroups,
    onSuccess: () => {
      toast.success('渠道关联分组已更新')
      queryClient.invalidateQueries({ queryKey: ['channel-monitor'] })
      queryClient.invalidateQueries({ queryKey: ['channels'] })
      props.onOpenChange(false)
    },
  })
  const handleSubmit = form.handleSubmit((values) => {
    mutation.mutate({ channelId: props.channel.id, groups: values.groups })
  })

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>更改关联分组</DialogTitle>
          <DialogDescription>
            {props.channel.name} · ID {props.channel.id}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form className='flex flex-col gap-5' onSubmit={handleSubmit}>
            <FormField
              control={form.control}
              name='groups'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>关联分组</FormLabel>
                  <FormDescription>
                    保存后会立即更新该渠道的分组关联
                  </FormDescription>
                  <FormControl>
                    {groupsQuery.isLoading ? (
                      <Skeleton className='h-10 w-full' />
                    ) : (
                      <MultiSelect
                        id={`channel-monitor-groups-${props.channel.id}`}
                        options={groupOptions}
                        selected={field.value}
                        onChange={field.onChange}
                        placeholder='选择分组'
                        emptyText='没有可选分组'
                        disabled={groupsQuery.isError || mutation.isPending}
                        maxVisibleChips={6}
                      />
                    )}
                  </FormControl>
                  {groupsQuery.isError && (
                    <div className='flex items-center justify-between gap-3 text-sm'>
                      <span className='text-destructive'>分组列表加载失败</span>
                      <Button
                        type='button'
                        variant='outline'
                        size='sm'
                        onClick={() => groupsQuery.refetch()}
                      >
                        <HugeiconsIcon
                          icon={Refresh01Icon}
                          data-icon='inline-start'
                        />
                        重试
                      </Button>
                    </div>
                  )}
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
              <Button
                type='submit'
                disabled={
                  mutation.isPending ||
                  groupsQuery.isLoading ||
                  groupsQuery.isError
                }
              >
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
