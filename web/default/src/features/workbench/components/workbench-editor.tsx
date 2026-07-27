/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { ArrowLeft, History, Search, Share2, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Spinner } from '@/components/ui/spinner'

import { getCanvasProject, updateCanvasProject } from '../api'
import { searchCanvasNodes } from '../engine/canvas-search'
import { useCanvasStore } from '../store/canvas-store'
import { CanvasNodeType, type CanvasDocument } from '../types'
import { CanvasShareDialog } from './canvas-share-dialog'
import { CanvasVersionHistory } from './canvas-version-history'
import { WorkbenchCanvas } from './workbench-canvas'
import { WorkbenchInspiration } from './workbench-inspiration'

const AUTOSAVE_DELAY_MS = 1500

type SaveState = 'idle' | 'saving' | 'saved' | 'conflict' | 'error'

function extractCover(doc: CanvasDocument): string {
  const imageNode = doc.nodes.find(
    (node) =>
      node.type === CanvasNodeType.Image &&
      typeof node.metadata?.content === 'string' &&
      node.metadata.content.length > 0
  )
  return imageNode?.metadata?.content ?? ''
}

export function WorkbenchEditor(props: { projectId: number }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [inspirationOpen, setInspirationOpen] = useState(false)
  const [conflictOpen, setConflictOpen] = useState(false)
  const [conflictBusy, setConflictBusy] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const baseUpdatedAtRef = useRef(0)
  const savedSignatureRef = useRef('')
  const savedCoverRef = useRef('')
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveInFlightRef = useRef<Promise<void> | null>(null)
  const dirtyWhileSavingRef = useRef(false)
  const [saveSequence, setSaveSequence] = useState(0)

  const revision = useCanvasStore((state) => state.revision)
  const loadDocument = useCanvasStore((state) => state.loadDocument)
  const nodes = useCanvasStore((state) => state.nodes)
  const experienceMode = useCanvasStore((state) => state.experienceMode)

  useEffect(() => {
    const openSearch = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', openSearch)
    return () => window.removeEventListener('keydown', openSearch)
  }, [])

  const project = useQuery({
    queryKey: ['workbench', 'canvas-project', props.projectId],
    queryFn: () => getCanvasProject(props.projectId),
    refetchOnWindowFocus: false,
  })

  useEffect(() => {
    if (!project.data) return
    let doc: Partial<CanvasDocument> | null = null
    try {
      doc = project.data.doc
        ? (JSON.parse(project.data.doc) as CanvasDocument)
        : null
    } catch {
      doc = null
    }
    setTitle(project.data.title)
    baseUpdatedAtRef.current = project.data.updated_at
    savedCoverRef.current = project.data.cover ?? ''
    savedSignatureRef.current = JSON.stringify({
      title: project.data.title,
      doc: doc ?? {},
    })
    loadDocument(doc)
  }, [loadDocument, project.data])

  useEffect(() => {
    if (!project.data) return
    if (saveState === 'conflict') return
    const signature = JSON.stringify({
      title,
      doc: useCanvasStore.getState().exportDocument(),
    })
    if (signature === savedSignatureRef.current) return
    if (saveInFlightRef.current) {
      dirtyWhileSavingRef.current = true
      return
    }

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      setSaveState('saving')
      const exported = useCanvasStore.getState().exportDocument()
      const docPayload = JSON.stringify(exported)
      const cover = extractCover(exported)
      const nextSignature = JSON.stringify({ title, doc: exported })
      const save = async () => {
        try {
          const payload: {
            title: string
            doc: string
            cover?: string
            base_updated_at: number
          } = {
            title,
            doc: docPayload,
            base_updated_at: baseUpdatedAtRef.current,
          }
          if (cover !== savedCoverRef.current) {
            payload.cover = cover
          }
          const result = await updateCanvasProject(props.projectId, payload)
          baseUpdatedAtRef.current = result.updated_at
          savedSignatureRef.current = nextSignature
          if (cover !== savedCoverRef.current) savedCoverRef.current = cover
          setSaveState('saved')
        } catch (error) {
          const message = error instanceof Error ? error.message : ''
          if (message.includes('modified elsewhere')) {
            setSaveState('conflict')
            setConflictOpen(true)
            return
          }
          setSaveState('error')
          toast.error(t('Failed to save the canvas'))
        } finally {
          saveInFlightRef.current = null
          if (dirtyWhileSavingRef.current) {
            dirtyWhileSavingRef.current = false
            setSaveSequence((value) => value + 1)
          }
        }
      }
      const request = save()
      saveInFlightRef.current = request
    }, AUTOSAVE_DELAY_MS)

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [
    project.data,
    props.projectId,
    revision,
    saveSequence,
    saveState,
    t,
    title,
  ])

  async function handleReloadFromServer() {
    setConflictBusy(true)
    try {
      const latest = await getCanvasProject(props.projectId)
      let doc: Partial<CanvasDocument> | null = null
      try {
        doc = latest.doc ? (JSON.parse(latest.doc) as CanvasDocument) : null
      } catch {
        doc = null
      }
      setTitle(latest.title)
      baseUpdatedAtRef.current = latest.updated_at
      savedCoverRef.current = latest.cover ?? ''
      savedSignatureRef.current = JSON.stringify({
        title: latest.title,
        doc: doc ?? {},
      })
      loadDocument(doc)
      setConflictOpen(false)
      setSaveState('saved')
      toast.success(t('Reloaded from server'))
    } catch {
      toast.error(t('Failed to reload the canvas'))
    } finally {
      setConflictBusy(false)
    }
  }

  async function handleOverwrite() {
    setConflictBusy(true)
    try {
      await saveInFlightRef.current
      const latest = await getCanvasProject(props.projectId)
      const exported = useCanvasStore.getState().exportDocument()
      const docPayload = JSON.stringify(exported)
      const cover = extractCover(exported)
      const payload: {
        title: string
        doc: string
        cover?: string
        base_updated_at: number
      } = {
        title,
        doc: docPayload,
        base_updated_at: latest.updated_at,
      }
      if (cover !== (latest.cover ?? '')) {
        payload.cover = cover
      }
      const result = await updateCanvasProject(props.projectId, payload)
      baseUpdatedAtRef.current = result.updated_at
      savedCoverRef.current = cover
      savedSignatureRef.current = JSON.stringify({
        title,
        doc: exported,
      })
      setConflictOpen(false)
      setSaveState('saved')
      toast.success(t('Local changes saved'))
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      if (message.includes('modified elsewhere')) {
        toast.error(t('This canvas was modified in another tab'))
        return
      }
      toast.error(t('Failed to save the canvas'))
    } finally {
      setConflictBusy(false)
    }
  }

  if (project.isLoading) {
    return (
      <div className='flex h-full items-center justify-center'>
        <Spinner />
      </div>
    )
  }

  if (project.isError) {
    return (
      <div className='flex h-full flex-col items-center justify-center gap-3'>
        <p className='text-muted-foreground text-sm'>
          {t('This canvas is not available.')}
        </p>
        <Button
          variant='outline'
          onClick={() =>
            navigate({ to: '/inspiration', search: { view: 'projects' } })
          }
        >
          {t('Back to canvases')}
        </Button>
      </div>
    )
  }

  return (
    <div className='flex h-full flex-col'>
      <div className='border-border/60 bg-background/80 flex shrink-0 items-center gap-2 border-b px-3 py-1.5 backdrop-blur'>
        <Button
          size='icon-sm'
          variant='ghost'
          aria-label={t('Back to canvases')}
          onClick={() =>
            navigate({ to: '/inspiration', search: { view: 'projects' } })
          }
        >
          <ArrowLeft />
        </Button>
        <Input
          value={title}
          className='h-8 w-40 border-transparent bg-transparent font-medium shadow-none sm:w-64'
          onChange={(event) => setTitle(event.target.value)}
        />
        <span className='text-muted-foreground hidden text-xs sm:inline'>
          {saveState === 'saving' ? t('Saving') : null}
          {saveState === 'saved' ? t('Saved') : null}
          {saveState === 'conflict' ? t('Not saved') : null}
          {saveState === 'error' ? t('Not saved') : null}
        </span>
        <div className='ml-auto flex items-center gap-1.5'>
          <Button
            size='sm'
            variant='outline'
            title={t('Inspiration')}
            onClick={() => setInspirationOpen(true)}
          >
            <Sparkles />
            <span className='hidden lg:inline'>{t('Inspiration')}</span>
          </Button>
          <div className='relative'>
            <Button
              size='sm'
              variant='outline'
              aria-expanded={searchOpen}
              title={t('Search nodes')}
              onClick={() => setSearchOpen((open) => !open)}
            >
              <Search />
              <span className='hidden lg:inline'>{t('Search nodes')}</span>
              <kbd className='text-muted-foreground ml-1 hidden lg:inline'>
                ⌘K
              </kbd>
            </Button>
            {searchOpen ? (
              <div className='bg-popover absolute top-10 right-0 z-50 w-80 rounded-md border p-2 shadow-lg'>
                <Input
                  autoFocus
                  role='searchbox'
                  aria-label={t('Search canvas nodes')}
                  placeholder={t('Search by title, prompt, text, or type')}
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
                <div role='listbox' className='mt-2 max-h-72 overflow-auto'>
                  {searchCanvasNodes(nodes, searchQuery).map((node) => (
                    <button
                      key={node.id}
                      type='button'
                      role='option'
                      aria-selected='false'
                      className='hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm'
                      onClick={() => {
                        window.dispatchEvent(
                          new CustomEvent('canvas:focus-node', {
                            detail: node.id,
                          })
                        )
                        setSearchOpen(false)
                      }}
                    >
                      <span className='truncate'>{node.title}</span>
                      <span className='text-muted-foreground ml-auto text-xs'>
                        {t(node.type)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          <Select
            value={experienceMode}
            onValueChange={(value) =>
              useCanvasStore
                .getState()
                .setExperienceMode(value as 'simple' | 'professional')
            }
          >
            <SelectTrigger
              size='sm'
              className='hidden w-36 md:flex'
              aria-label={t('Canvas mode')}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='simple'>{t('Simple')}</SelectItem>
              <SelectItem value='professional'>{t('Professional')}</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size='sm'
            variant='outline'
            title={t('Share')}
            onClick={() => setShareOpen(true)}
          >
            <Share2 />
            <span className='hidden lg:inline'>{t('Share')}</span>
          </Button>
          <Button
            size='sm'
            variant='outline'
            title={t('History')}
            onClick={() => setHistoryOpen(true)}
          >
            <History />
            <span className='hidden lg:inline'>{t('History')}</span>
          </Button>
        </div>
      </div>

      <div className='min-h-0 flex-1'>
        <WorkbenchCanvas />
      </div>

      <CanvasVersionHistory
        projectId={props.projectId}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
      />
      <CanvasShareDialog
        projectId={props.projectId}
        open={shareOpen}
        onOpenChange={setShareOpen}
      />
      <Sheet open={inspirationOpen} onOpenChange={setInspirationOpen}>
        <SheetContent side='right' className='w-full sm:max-w-3xl'>
          <SheetHeader>
            <SheetTitle>{t('Inspiration')}</SheetTitle>
          </SheetHeader>
          <WorkbenchInspiration onApplied={() => setInspirationOpen(false)} />
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={conflictOpen}
        onOpenChange={(open) => {
          if (conflictBusy) return
          setConflictOpen(open)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('This canvas was modified elsewhere')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                'Another tab or session saved a newer version. Reload to discard your local changes, or overwrite with what you have here.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant='outline'
              disabled={conflictBusy}
              onClick={() => void handleReloadFromServer()}
            >
              {t('Reload from server')}
            </Button>
            <Button
              disabled={conflictBusy}
              onClick={() => void handleOverwrite()}
            >
              {t('Overwrite')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
