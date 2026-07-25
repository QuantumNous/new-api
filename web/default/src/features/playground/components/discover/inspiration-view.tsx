/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { useQuery } from '@tanstack/react-query'
import { Download, History, Images, Loader2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  CardStaggerContainer,
  CardStaggerItem,
  PageTransition,
} from '@/components/page-transition'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { listPlaygroundTasks } from '../../api'
import { downloadGeneratedMedia } from '../../lib/download-generated-media'
import { modalityLabelKey } from '../../lib/workbench/modality-styles'
import type {
  InspirationWork,
  RecentPrompt,
} from '../../lib/workbench/workbench-prefs'
import type { StudioModality } from '../../types'
import { InspirationGallery } from './inspiration-gallery'

type InspirationView = 'square' | 'works' | 'usage'

type InspirationViewProps = {
  myWorks: InspirationWork[]
  recentPrompts: RecentPrompt[]
  onApplyPrompt: (prompt: string, modality: StudioModality) => void
  isAuthenticated: boolean
  availableModels: Array<{ name: string; modality: string }>
  onRequireAuth: () => void
  onRemoveWork?: (id: string) => void
  className?: string
}

function mediaToolLabel(
  modality: StudioModality,
  model: string | undefined,
  t: (key: string) => string
): string {
  if (modality === 'image') return t('Image generation')
  if (modality === 'video') return t('Video generation')
  if (modality === 'audio') return t('Audio generation')
  const modelPart = model?.trim() ? model : t('Chat')
  return `${modelPart} · ${t(modalityLabelKey(modality))}`
}

/**
 * Full-width Inspiration view (templates / my works / recent prompts)
 * rendered in the workspace center when the toolbar's Inspiration tab is
 * active.
 */
export function InspirationView(props: InspirationViewProps) {
  const { t } = useTranslation()
  const [view, setView] = useState<InspirationView>('square')
  const [downloadingWorkId, setDownloadingWorkId] = useState('')
  const serverWorks = useQuery({
    queryKey: ['playground', 'runs'],
    queryFn: listPlaygroundTasks,
    enabled: view === 'works',
  })

  const downloadWork = async (work: InspirationWork) => {
    if (!work.previewUrl || work.modality === 'chat') return
    setDownloadingWorkId(work.id)
    try {
      await downloadGeneratedMedia(
        work.previewUrl,
        `generated-${work.modality}-${work.id}`,
        work.modality
      )
    } catch {
      toast.error(t('Download failed'))
    } finally {
      setDownloadingWorkId('')
    }
  }

  const worksList = useMemo(() => {
    const serverRuns = (serverWorks.data?.runs ?? []).map((run) => ({
      id: `run-${run.id}`,
      title: run.prompt.slice(0, 48) || t('Untitled work'),
      prompt: run.prompt,
      modality: run.modality as StudioModality,
      createdAt: run.created_at * 1000,
      model: run.model,
      previewUrl: run.result_url,
    }))
    // Prefer server runs when available, merge local works
    const local = props.myWorks
    if (serverRuns.length === 0) return local
    const localIds = new Set(serverRuns.map((r) => r.id))
    return [...serverRuns, ...local.filter((w) => !localIds.has(w.id))]
  }, [props.myWorks, serverWorks.data?.runs, t])

  return (
    <div
      className={cn(
        'playground-discover-hero min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4 md:p-8',
        props.className
      )}
    >
      <PageTransition className='space-y-4'>
        <div className='flex flex-col justify-between gap-4 sm:flex-row sm:items-end'>
          <div>
            <h1 className='text-foreground text-2xl font-semibold tracking-tight'>
              {t('Inspiration')}
            </h1>
            <p className='text-muted-foreground mt-1 text-sm'>
              {t(
                'Templates, saved works, and recent prompts for faster starts.'
              )}
            </p>
          </div>
        </div>

        <div
          className='bg-muted/40 ring-border flex max-w-md gap-1 rounded-lg p-1 ring-1'
          role='tablist'
          aria-label={t('Inspiration views')}
        >
          {(
            [
              ['square', 'Square'],
              ['works', 'My works'],
              ['usage', 'Usage'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type='button'
              role='tab'
              aria-selected={view === id}
              onClick={() => setView(id)}
              className={cn(
                'focus-visible:ring-ring flex-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors outline-none focus-visible:ring-2',
                view === id
                  ? 'bg-background text-primary shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t(label)}
            </button>
          ))}
        </div>

        {view === 'square' && (
          <InspirationGallery
            isAuthenticated={props.isAuthenticated}
            availableModels={props.availableModels}
            onRequireAuth={props.onRequireAuth}
          />
        )}

        {view === 'works' && (
          <CardStaggerContainer className='space-y-2'>
            {worksList.length === 0 && (
              <div className='py-10 text-center'>
                <div className='bg-primary/10 text-primary mx-auto flex size-10 items-center justify-center rounded-xl'>
                  <Images className='size-5' aria-hidden='true' />
                </div>
                <p className='text-muted-foreground mt-3 text-sm'>
                  {t('Generations you save will show up here.')}
                </p>
              </div>
            )}
            {worksList.map((work) => (
              <CardStaggerItem
                key={work.id}
                className='border-border bg-muted/40 rounded-xl border p-3'
              >
                <div className='flex items-start justify-between gap-2'>
                  <button
                    type='button'
                    className='min-w-0 text-left'
                    onClick={() =>
                      props.onApplyPrompt(work.prompt, work.modality)
                    }
                  >
                    <p className='text-foreground truncate text-sm font-medium'>
                      {work.title}
                    </p>
                    <p className='text-muted-foreground mt-1 line-clamp-2 text-[11px]'>
                      {work.prompt}
                    </p>
                  </button>
                  <div className='flex shrink-0 items-center gap-1'>
                    {work.previewUrl && work.modality !== 'chat' && (
                      <Button
                        size='icon-sm'
                        variant='ghost'
                        aria-label={t('Download')}
                        disabled={downloadingWorkId === work.id}
                        onClick={() => void downloadWork(work)}
                      >
                        {downloadingWorkId === work.id ? (
                          <Loader2 className='size-4 animate-spin' />
                        ) : (
                          <Download className='size-4' />
                        )}
                      </Button>
                    )}
                    {props.onRemoveWork &&
                      !String(work.id).startsWith('run-') && (
                        <Button
                          size='sm'
                          variant='ghost'
                          className='text-muted-foreground h-7 text-xs'
                          onClick={() => props.onRemoveWork?.(work.id)}
                        >
                          {t('Remove')}
                        </Button>
                      )}
                  </div>
                </div>
                {work.previewUrl && work.modality === 'image' && (
                  <img
                    src={work.previewUrl}
                    alt={work.title}
                    loading='lazy'
                    decoding='async'
                    referrerPolicy='no-referrer'
                    className='bg-muted/40 mt-2 aspect-video w-full rounded-lg object-contain'
                  />
                )}
                {work.previewUrl && work.modality === 'video' && (
                  <video
                    src={work.previewUrl}
                    controls
                    preload='metadata'
                    className='mt-2 aspect-video w-full rounded-lg bg-black'
                  >
                    {t('Your browser does not support video playback.')}
                  </video>
                )}
                {work.previewUrl && work.modality === 'audio' && (
                  <audio src={work.previewUrl} controls className='mt-2 w-full'>
                    {t('Your browser does not support audio playback.')}
                  </audio>
                )}
              </CardStaggerItem>
            ))}
          </CardStaggerContainer>
        )}

        {view === 'usage' && (
          <CardStaggerContainer className='space-y-2'>
            {props.recentPrompts.length === 0 && (
              <div className='py-10 text-center'>
                <div className='bg-primary/10 text-primary mx-auto flex size-10 items-center justify-center rounded-xl'>
                  <History className='size-5' aria-hidden='true' />
                </div>
                <p className='text-muted-foreground mt-3 text-sm'>
                  {t('Recent prompts from this browser will appear here.')}
                </p>
              </div>
            )}
            {props.recentPrompts.map((item) => (
              <CardStaggerItem key={item.id}>
                <button
                  type='button'
                  onClick={() =>
                    props.onApplyPrompt(item.prompt, item.modality)
                  }
                  className='border-border bg-muted/40 hover:border-primary/30 w-full rounded-xl border p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm motion-reduce:transition-none motion-reduce:hover:translate-y-0'
                >
                  <p className='text-foreground line-clamp-2 text-sm'>
                    {item.prompt}
                  </p>
                  <p className='text-muted-foreground mt-1 text-[10px]'>
                    {mediaToolLabel(item.modality, item.model, t)}
                  </p>
                </button>
              </CardStaggerItem>
            ))}
          </CardStaggerContainer>
        )}
      </PageTransition>
    </div>
  )
}
