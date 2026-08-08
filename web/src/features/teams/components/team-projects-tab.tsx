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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatTimestampToDate } from '@/lib/format'

import {
  addTeamProject,
  listTeamProjects,
  removeTeamProject,
} from '../api'
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '../constants'
import {
  TEAM_PROJECT_FORM_DEFAULT_VALUES,
  getTeamProjectFormSchema,
  transformProjectFormDataToPayload,
  type TeamProjectFormValues,
} from '../lib'
import type { TeamProject } from '../types'

export function TeamProjectsTab({ teamId }: { teamId: number }) {
  const { t } = useTranslation()
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [addOpen, setAddOpen] = useState(false)
  const [removingProject, setRemovingProject] = useState<TeamProject | null>(
    null
  )
  const [isRemoving, setIsRemoving] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const triggerRefresh = () => setRefreshTrigger((prev) => prev + 1)

  const form = useForm<TeamProjectFormValues>({
    resolver: zodResolver(getTeamProjectFormSchema(t)),
    defaultValues: TEAM_PROJECT_FORM_DEFAULT_VALUES,
  })

  useEffect(() => {
    if (addOpen) {
      form.reset(TEAM_PROJECT_FORM_DEFAULT_VALUES)
    }
  }, [addOpen, form])

  const { data, isLoading } = useQuery({
    queryKey: ['team-projects', teamId, refreshTrigger],
    queryFn: async () => {
      const result = await listTeamProjects(teamId)
      if (!result.success) {
        toast.error(result.message || t(ERROR_MESSAGES.LOAD_PROJECTS_FAILED))
        return []
      }
      return result.data?.items ?? []
    },
    placeholderData: (previousData) => previousData,
  })

  const items = data ?? []

  const onSubmit = async (values: TeamProjectFormValues) => {
    setIsSubmitting(true)
    try {
      const result = await addTeamProject(
        teamId,
        transformProjectFormDataToPayload(values)
      )
      if (result.success) {
        toast.success(t(SUCCESS_MESSAGES.PROJECT_ADDED))
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
    if (!removingProject) return
    setIsRemoving(true)
    try {
      const result = await removeTeamProject(teamId, removingProject.id)
      if (result.success) {
        toast.success(t(SUCCESS_MESSAGES.PROJECT_REMOVED))
        setRemovingProject(null)
        triggerRefresh()
      }
    } finally {
      setIsRemoving(false)
    }
  }

  return (
    <div className='space-y-4'>
      <div className='flex justify-end'>
        <Button size='sm' onClick={() => setAddOpen(true)}>
          <Plus className='h-4 w-4' />
          {t('Add Project')}
        </Button>
      </div>

      <div className='overflow-hidden rounded-lg border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('Name')}</TableHead>
              <TableHead>{t('Description')}</TableHead>
              <TableHead>{t('Created At')}</TableHead>
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
                  {t('No team projects yet')}
                </TableCell>
              </TableRow>
            )}
            {items.map((project) => (
              <TableRow key={project.id}>
                <TableCell className='font-medium'>{project.name}</TableCell>
                <TableCell className='text-muted-foreground text-sm'>
                  {project.description || '-'}
                </TableCell>
                <TableCell className='text-muted-foreground text-sm'>
                  {project.created_at > 0
                    ? formatTimestampToDate(project.created_at)
                    : '-'}
                </TableCell>
                <TableCell className='text-right'>
                  <Button
                    variant='ghost'
                    size='icon-sm'
                    aria-label={t('Remove')}
                    className='text-destructive'
                    onClick={() => setRemovingProject(project)}
                  >
                    <Trash2 />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Add Project')}</DialogTitle>
            <DialogDescription>
              {t('Create a project under this team.')}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              id='team-project-form'
              onSubmit={handleSubmit}
              className='space-y-4'
            >
              <FormField
                control={form.control}
                name='name'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Name')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='description'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Description')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
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
              form='team-project-form'
              type='submit'
              disabled={isSubmitting}
            >
              {isSubmitting ? t('Saving...') : t('Add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!removingProject}
        onOpenChange={(open) => !open && setRemovingProject(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Are you sure?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('This will delete project')}{' '}
              <span className='font-semibold'>{removingProject?.name}</span>
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
