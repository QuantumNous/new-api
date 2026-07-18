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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'

import { updateChannelMonitorGroupRatio } from '../api'
import {
  createGroupRatioSchema,
  type GroupRatioFormValues,
} from '../lib/schema'
import type { GroupMonitorItem } from '../types'

type EditGroupRatioDialogProps = {
  group: GroupMonitorItem
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditGroupRatioDialog(props: EditGroupRatioDialogProps) {
  const queryClient = useQueryClient()
  const schema = createGroupRatioSchema()
  const form = useForm<GroupRatioFormValues>({
    resolver: zodResolver(schema) as Resolver<GroupRatioFormValues>,
    defaultValues: { ratio: props.group.ratio },
  })

  const mutation = useMutation({
    mutationFn: updateChannelMonitorGroupRatio,
    onSuccess: () => {
      toast.success('分组倍率已保存')
      queryClient.invalidateQueries({ queryKey: ['channel-monitor'] })
      props.onOpenChange(false)
    },
  })

  const handleSubmit = form.handleSubmit((values) => {
    mutation.mutate({ group: props.group.name, ratio: values.ratio })
  })

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>修改分组倍率</DialogTitle>
          <DialogDescription>
            {props.group.name} · 影响 {props.group.channels.length} 个关联渠道
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form className='flex flex-col gap-4' onSubmit={handleSubmit}>
            <FormField
              control={form.control}
              name='ratio'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>分组倍率</FormLabel>
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
              <Button type='submit' disabled={mutation.isPending}>
                {mutation.isPending && <Spinner data-icon='inline-start' />}
                保存
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
