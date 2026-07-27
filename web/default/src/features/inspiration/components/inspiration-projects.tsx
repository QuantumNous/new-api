/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Copy, ImageOff, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  createCanvasProject,
  deleteCanvasProject,
  getCanvasProject,
  listCanvasProjects,
  updateCanvasProject,
} from '@/features/workbench/api'
import type { CanvasProjectMeta } from '@/features/workbench/types'

import { CANVAS_PROJECTS_QUERY_KEY } from '../constants'

type SortMode = 'updated' | 'created' | 'title'

export function InspirationProjects(props: {
  isAuthenticated: boolean
  creating: boolean
  onRequireAuth: () => void
  onCreateBlank: () => void
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('updated')
  const [renaming, setRenaming] = useState<CanvasProjectMeta | null>(null)
  const [renameTitle, setRenameTitle] = useState('')

  const projects = useQuery({
    queryKey: CANVAS_PROJECTS_QUERY_KEY,
    queryFn: listCanvasProjects,
    enabled: props.isAuthenticated,
  })

  const removeProject = useMutation({
    mutationFn: (id: number) => deleteCanvasProject(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: CANVAS_PROJECTS_QUERY_KEY }),
    onError: () => toast.error(t('Failed to delete the canvas')),
  })

  const renameProject = useMutation({
    mutationFn: (input: { id: number; title: string; baseUpdatedAt: number }) =>
      updateCanvasProject(input.id, {
        title: input.title,
        base_updated_at: input.baseUpdatedAt,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: CANVAS_PROJECTS_QUERY_KEY,
      })
      setRenaming(null)
    },
    onError: () => toast.error(t('Failed to rename the canvas')),
  })

  const duplicateProject = useMutation({
    mutationFn: async (project: CanvasProjectMeta) => {
      const full = await getCanvasProject(project.id)
      return createCanvasProject({
        title: `${project.title} (copy)`,
        doc: full.doc,
        cover: full.cover ?? project.cover,
      })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: CANVAS_PROJECTS_QUERY_KEY,
      })
      toast.success(t('Canvas duplicated'))
    },
    onError: () => toast.error(t('Failed to duplicate the canvas')),
  })

  const filteredProjects = useMemo(() => {
    const query = search.trim().toLowerCase()
    const list = (projects.data ?? []).filter(
      (project) => !query || project.title.toLowerCase().includes(query)
    )
    const sorted = [...list]
    if (sortMode === 'created') {
      sorted.sort((a, b) => b.created_at - a.created_at)
    } else if (sortMode === 'title') {
      sorted.sort((a, b) => a.title.localeCompare(b.title))
    } else {
      sorted.sort((a, b) => b.updated_at - a.updated_at)
    }
    return sorted
  }, [projects.data, search, sortMode])

  const openProject = (id: number) =>
    void navigate({
      to: '/inspiration/$projectId',
      params: { projectId: String(id) },
    })

  if (!props.isAuthenticated) {
    return (
      <section className='border-border/60 rounded-2xl border border-dashed py-16 text-center'>
        <p className='text-muted-foreground mb-3 text-sm'>
          {t('Sign in to keep your projects across devices.')}
        </p>
        <Button onClick={props.onRequireAuth}>{t('Sign in')}</Button>
      </section>
    )
  }

  return (
    <section className='space-y-5'>
      <div className='flex flex-col gap-3 sm:flex-row sm:items-center'>
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('Search canvases')}
          className='rounded-full sm:max-w-xs'
        />
        <Select
          value={sortMode}
          onValueChange={(value) => setSortMode(value as SortMode)}
        >
          <SelectTrigger className='w-full rounded-full sm:w-48'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='updated'>{t('Recently updated')}</SelectItem>
            <SelectItem value='created'>{t('Recently created')}</SelectItem>
            <SelectItem value='title'>{t('Title A-Z')}</SelectItem>
          </SelectContent>
        </Select>
        <Button
          className='rounded-full sm:ml-auto'
          disabled={props.creating}
          onClick={props.onCreateBlank}
        >
          {props.creating ? <Loader2 className='animate-spin' /> : <Plus />}
          {t('New free-form project')}
        </Button>
      </div>

      {projects.isLoading ? (
        <div className='text-muted-foreground flex justify-center gap-2 py-16 text-sm'>
          <Loader2 className='size-4 animate-spin' aria-hidden='true' />
          {t('Loading')}
        </div>
      ) : null}

      {!projects.isLoading && !filteredProjects.length ? (
        <div className='border-border/60 rounded-2xl border border-dashed py-16 text-center'>
          <p className='text-muted-foreground text-sm text-pretty'>
            {projects.data?.length
              ? t('No canvases match your search.')
              : t('Create a canvas to compose prompts, images, and shots.')}
          </p>
        </div>
      ) : null}

      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
        {filteredProjects.map((project) => (
          <article
            key={project.id}
            className='group border-border/70 bg-card overflow-hidden rounded-2xl border shadow-xs transition-shadow hover:shadow-lg'
          >
            <button
              type='button'
              className='bg-muted focus-visible:ring-ring block aspect-video w-full outline-none focus-visible:ring-2'
              onClick={() => openProject(project.id)}
            >
              {project.cover ? (
                <img
                  src={project.cover}
                  alt=''
                  loading='lazy'
                  className='size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]'
                />
              ) : (
                <span className='text-muted-foreground flex size-full items-center justify-center'>
                  <ImageOff className='size-6' aria-hidden='true' />
                </span>
              )}
            </button>
            <div className='flex items-start justify-between gap-2 p-3.5'>
              <button
                type='button'
                className='min-w-0 flex-1 text-left'
                onClick={() => openProject(project.id)}
              >
                <p className='truncate text-sm font-medium'>{project.title}</p>
                <p className='text-muted-foreground mt-1 text-xs'>
                  {new Date(project.updated_at * 1000).toLocaleString()}
                </p>
              </button>
              <div className='flex shrink-0 items-center gap-0.5'>
                <Button
                  size='icon-sm'
                  variant='ghost'
                  aria-label={t('Rename')}
                  onClick={() => {
                    setRenaming(project)
                    setRenameTitle(project.title)
                  }}
                >
                  <Pencil />
                </Button>
                <Button
                  size='icon-sm'
                  variant='ghost'
                  aria-label={t('Duplicate')}
                  disabled={duplicateProject.isPending}
                  onClick={() => duplicateProject.mutate(project)}
                >
                  <Copy />
                </Button>
                <Button
                  size='icon-sm'
                  variant='ghost'
                  aria-label={t('Delete')}
                  onClick={() => removeProject.mutate(project.id)}
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
          </article>
        ))}
      </div>

      <Dialog
        open={renaming !== null}
        onOpenChange={(open) => {
          if (!open) setRenaming(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Rename canvas')}</DialogTitle>
          </DialogHeader>
          <Input
            value={renameTitle}
            onChange={(event) => setRenameTitle(event.target.value)}
            autoFocus
            onKeyDown={(event) => {
              if (event.key !== 'Enter' || !renaming) return
              const nextTitle = renameTitle.trim()
              if (!nextTitle) return
              renameProject.mutate({
                id: renaming.id,
                title: nextTitle,
                baseUpdatedAt: renaming.updated_at,
              })
            }}
          />
          <DialogFooter>
            <Button variant='outline' onClick={() => setRenaming(null)}>
              {t('Cancel')}
            </Button>
            <Button
              disabled={
                renameProject.isPending ||
                !renameTitle.trim() ||
                renaming === null
              }
              onClick={() => {
                if (!renaming) return
                const nextTitle = renameTitle.trim()
                if (!nextTitle) return
                renameProject.mutate({
                  id: renaming.id,
                  title: nextTitle,
                  baseUpdatedAt: renaming.updated_at,
                })
              }}
            >
              {t('Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
