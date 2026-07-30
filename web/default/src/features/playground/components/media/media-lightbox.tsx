/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Loader2,
  X,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

import { downloadGeneratedMedia } from '../../lib/download-generated-media'

export type LightboxItem = {
  url: string
  alt?: string
  caption?: string
  downloadName?: string
}

function DownloadIcon(props: { downloading: boolean; done: boolean }) {
  if (props.downloading) return <Loader2 className='size-4 animate-spin' />
  if (props.done) return <Check className='size-4' />
  return <Download className='size-4' />
}

type MediaLightboxProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: LightboxItem[]
  index: number
  onIndexChange: (index: number) => void
  /** Extra per-item actions rendered next to download (e.g. use as reference). */
  actions?: (item: LightboxItem, index: number) => ReactNode
}

/**
 * Full-screen media viewer for generated and attached images: constrained
 * natural-size display, keyboard navigation, download and open-original.
 */
export function MediaLightbox(props: MediaLightboxProps) {
  const { t } = useTranslation()
  const [downloading, setDownloading] = useState(false)
  const [downloadDone, setDownloadDone] = useState(false)
  const count = props.items.length
  const index = Math.min(Math.max(props.index, 0), Math.max(count - 1, 0))
  const item = props.items[index]

  useEffect(() => {
    setDownloading(false)
    setDownloadDone(false)
  }, [index, props.open])

  useEffect(() => {
    if (!props.open || count <= 1) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        props.onIndexChange((index - 1 + count) % count)
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        props.onIndexChange((index + 1) % count)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [props, index, count])

  if (!item) return null

  const download = async () => {
    setDownloading(true)
    try {
      await downloadGeneratedMedia(
        item.url,
        item.downloadName || `image-${index + 1}`,
        'image'
      )
      setDownloadDone(true)
      toast.success(t('Download started'))
    } catch {
      toast.error(t('Download failed'))
    } finally {
      setDownloading(false)
    }
  }

  const canOpenOriginal =
    !item.url.startsWith('data:') && !item.url.startsWith('blob:')

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          'top-0 left-0 h-dvh w-screen max-w-none translate-x-0 translate-y-0',
          'flex flex-col rounded-none border-0 bg-black/90 p-0 ring-0'
        )}
      >
        <DialogTitle className='sr-only'>
          {item.alt || t('Image preview')}
        </DialogTitle>

        <div className='flex items-center justify-between gap-2 px-3 pt-3 sm:px-4'>
          <span className='text-xs text-white/60 tabular-nums'>
            {count > 1 ? `${index + 1} / ${count}` : ''}
          </span>
          <Button
            size='icon'
            variant='ghost'
            className='text-white/80 hover:bg-white/10 hover:text-white'
            aria-label={t('Close')}
            onClick={() => props.onOpenChange(false)}
          >
            <X className='size-5' />
          </Button>
        </div>

        <div className='relative flex min-h-0 flex-1 items-center justify-center px-3 sm:px-14'>
          {count > 1 && (
            <Button
              size='icon'
              variant='ghost'
              className='absolute left-2 z-10 text-white/80 hover:bg-white/10 hover:text-white sm:left-4'
              aria-label={t('Previous image')}
              onClick={() => props.onIndexChange((index - 1 + count) % count)}
            >
              <ChevronLeft className='size-6' />
            </Button>
          )}
          <img
            key={item.url}
            src={item.url}
            alt={item.alt || t('Image preview')}
            className='max-h-full max-w-full object-contain select-none'
            referrerPolicy='no-referrer'
            draggable={false}
          />
          {count > 1 && (
            <Button
              size='icon'
              variant='ghost'
              className='absolute right-2 z-10 text-white/80 hover:bg-white/10 hover:text-white sm:right-4'
              aria-label={t('Next image')}
              onClick={() => props.onIndexChange((index + 1) % count)}
            >
              <ChevronRight className='size-6' />
            </Button>
          )}
        </div>

        <div className='flex flex-col gap-2 px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom,0px))] sm:px-6'>
          {item.caption && (
            <p className='mx-auto line-clamp-2 max-w-2xl text-center text-xs text-pretty text-white/70'>
              {item.caption}
            </p>
          )}
          <div className='flex flex-wrap items-center justify-center gap-2'>
            <Button
              size='sm'
              variant='secondary'
              className='bg-white/10 text-white hover:bg-white/20'
              disabled={downloading}
              onClick={() => void download()}
            >
              <DownloadIcon downloading={downloading} done={downloadDone} />
              {downloadDone ? t('Saved') : t('Download')}
            </Button>
            {canOpenOriginal && (
              <Button
                size='sm'
                variant='secondary'
                className='bg-white/10 text-white hover:bg-white/20'
                onClick={() => window.open(item.url, '_blank', 'noopener')}
              >
                <ExternalLink className='size-4' />
                {t('Open original')}
              </Button>
            )}
            {props.actions?.(item, index)}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
