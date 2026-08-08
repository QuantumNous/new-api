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
*/
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { StatusBadge } from '@/components/status-badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatTimestampToDate } from '@/lib/format'

import { addTeamMember, listTeamMembers, removeTeamMember } from '../api'
import {
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  TEAM_MEMBER_ROLE_CONFIG,
  getTeamMemberRoleOptions,
} from '../constants'
import {
  TEAM_MEMBER_FORM_DEFAULT_VALUES,
  type TeamMemberFormValues,
  getTeamMemberFormSchema,
  transformMemberFormDataToPayload,
} from '../lib'
import type { TeamMember } from '../types'

const PAGE_SIZE = 20

export function TeamMembersTab({ teamId }: { teamId: number }) {
  const { t } = useTranslation()
  const [page, setPage] = useState(1)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [addOpen, setAddOpen] = useState(false)
  const [removingMember, setRemovingMember] = useState<TeamMember | null>(null)
  const [isRemoving, setIsRemoving] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const triggerRefresh = () => setRefreshTrigger((prev) => prev + 1)

  const form = useForm<TeamMemberFormValues>({
    resolver: zodResolver(getTeamMemberFormSchema(t)),
    defaultValues: TEAM_MEMBER_FORM_DEFAULT_VALUES,
  })

  useEffect(() => {
    if (addOpen) {
      form.reset(TEAM_MEMBER_FORM_DEFAULT_VALUES)
    }
  }, [addOpen, form])

  const { data, isLoading } = useQuery({
    queryKey: ['team-members', teamId, page, refreshTrigger],
    queryFn: async () => {
      const result = await listTeamMembers(teamId, {
        page,
        page_size: PAGE_SIZE,
      })
      if (!result.success) {
        toast.error(result.message || t(ERROR_MESSAGES.LOAD_MEMBERS_FAILED))
        return { items: [], total: 0 }
      }
      return {
        items: result.data?.items ?? [],
        total: result.data?.total ?? 0,
      }
    },
    placeholderData: (previousData) => previousData,
  })

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const onSubmit = async (values: TeamMemberFormValues) => {
    setIsSubmitting(true)
    try {
      const result = await addTeamMember(
        teamId,
        transformMemberFormDataToPayload(values)
      )
      if (result.success) {
        toast.success(t(SUCCESS_MESSAGES.MEMBER_ADDED))
        setAddOpen(false)
        triggerRefresh()
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    void form.handleSubmit(onSubmit)(event)
  }

  const handleRemove = async () => {
    if (!removingMember) return
    setIsRemoving(true)
    try {
      const result = await removeTeamMember(teamId, removingMember.user_id)
      if (result.success) {
        toast.success(t(SUCCESS_MESSAGES.MEMBER_REMOVED))
        setRemovingMember(null)
        triggerRefresh()
      }
    } finally {
      setIsRemoving(false)
    }
  }

  const roleOptions = getTeamMemberRoleOptions(t)

  return (
    <div className='space-y-4'>
      <div className='flex justify-end'>
        <Button size='sm' onClick={() => setAddOpen(true)}>
          <Plus className='h-4 w-4' />
          {t('Add Member')}
        </Button>
      </div>

      <div className='overflow-hidden rounded-lg border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('User ID')}</TableHead>
              <TableHead>{t('Role')}</TableHead>
              <TableHead>{t('Joined At')}</TableHead>
              <TableHead className='text-right'>{t('Actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className='text-muted-foreground py-8 text-center'
                >
                  {t('Loading...')}
                </TableCell>
              </TableRow>
            )}
            {!isLoading && items.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className='text-muted-foreground py-8 text-center'
                >
                  {t('No team members yet')}
                </TableCell>
              </TableRow>
            )}
            {items.map((member) => {
              const roleConfig = TEAM_MEMBER_ROLE_CONFIG[member.role]
              return (
                <TableRow key={member.id}>
                  <TableCell className='tabular-nums'>
                    {member.user_id}
                  </TableCell>
                  <TableCell>
                    {roleConfig ? (
                      <StatusBadge
                        label={t(roleConfig.labelKey)}
                        variant={roleConfig.variant}
                        copyable={false}
                        className='-ml-1.5'
                      />
                    ) : (
                      member.role
                    )}
                  </TableCell>
                  <TableCell className='text-muted-foreground text-sm'>
                    {member.created_at > 0
                      ? formatTimestampToDate(member.created_at)
                      : '-'}
                  </TableCell>
                  <TableCell className='text-right'>
                    <Button
                      variant='ghost'
                      size='icon-sm'
                      aria-label={t('Remove')}
                      className='text-destructive'
                      onClick={() => setRemovingMember(member)}
                    >
                      <Trash2 />
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {total > PAGE_SIZE && (
        <div className='flex items-center justify-between'>
          <span className='text-muted-foreground text-sm'>
            {t('Page')} {page} / {totalPages}
          </span>
          <div className='flex gap-2'>
            <Button
              variant='outline'
              size='sm'
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              {t('Previous')}
            </Button>
            <Button
              variant='outline'
              size='sm'
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              {t('Next')}
            </Button>
          </div>
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Add Member')}</DialogTitle>
            <DialogDescription>
              {t('Add an existing user to this team by their user ID.')}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              id='team-member-form'
              onSubmit={handleSubmit}
              className='space-y-4'
            >
              <FormField
                control={form.control}
                name='user_id'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('User ID')}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type='number'
                        onChange={(e) =>
                          field.onChange(
                            Number.parseInt(e.target.value, 10) || 0
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='role'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Role')}</FormLabel>
                    <Select
                      items={roleOptions}
                      onValueChange={(v) => field.onChange(String(v))}
                      value={field.value || ''}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('Select a role')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent alignItemWithTrigger={false}>
                        <SelectGroup>
                          {roleOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
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
              form='team-member-form'
              type='submit'
              disabled={isSubmitting}
            >
              {isSubmitting ? t('Saving...') : t('Add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!removingMember}
        onOpenChange={(open) => !open && setRemovingMember(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Are you sure?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('This will remove user')}{' '}
              <span className='font-semibold'>{removingMember?.user_id}</span>
              {t(' from this team. This action cannot be undone.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemoving}>
              {t('Cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              disabled={isRemoving}
              variant='destructive'
            >
              {isRemoving ? t('Removing...') : t('Remove')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
