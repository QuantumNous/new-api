/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { Check, Download, ImagePlus, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type GenerationImageCardProps = {
  url: string
  alt: string
  caption?: string
  filename: string
  downloading: boolean
  onDownload: () => void
  /** Opens the full-size viewer (click on the image itself). */
  onOpen?: () => void
  /** Adds this image to the composer as an edit reference. */
  onUseAsReference?: () => void
  index?: number
  /** Requested generation size (e.g. 1024x1536) used until natural size loads */
  requestedSize?: string
}

function parseSizeLabel(size?: string): string | null {
  if (!size) return null
  const match = /^(\d+)\s*[x×]\s*(\d+)$/i.exec(size.trim())
  if (!match) return size
  return `${match[1]}×${match[2]}`
}

function parseAspectCss(size?: string): string {
  if (!size) return '1 / 1'
  const match = /^(\d+)\s*[x×]\s*(\d+)$/i.exec(size.trim())
  if (!match) return '1 / 1'
  const w = Number(match[1])
  const h = Number(match[2])
  if (!w || !h) return '1 / 1'
  return `${w} / ${h}`
}

export function GenerationImageCard(props: GenerationImageCardProps) {
  const { t } = useTranslation()
  const [loaded, setLoaded] = useState(false)
  const [justDownloaded, setJustDownloaded] = useState(false)
  const [naturalSize, setNaturalSize] = useState<{
    w: number
    h: number
  } | null>(null)

  useEffect(() => {
    setLoaded(false)
    setNaturalSize(null)
  }, [props.url])

  useEffect(() => {
    if (!justDownloaded) return
    const id = window.setTimeout(() => setJustDownloaded(false), 1600)
    return () => window.clearTimeout(id)
  }, [justDownloaded])

  const handleDownload = () => {
    props.onDownload()
    setJustDownloaded(true)
  }

  const sizeLabel = naturalSize
    ? `${naturalSize.w}×${naturalSize.h}`
    : parseSizeLabel(props.requestedSize)
  const aspectCss = naturalSize
    ? `${naturalSize.w} / ${naturalSize.h}`
    : parseAspectCss(props.requestedSize)
  const enterDelayMs = (props.index ?? 0) * 70

  return (
    <figure
      className={cn(
        'border-border/80 bg-muted/40 group relative overflow-hidden rounded-2xl border',
        'ring-foreground/5 ring-1 ring-inset transition-shadow duration-300',
        'generation-result-enter hover:border-border hover:shadow-md'
      )}
      style={{ animationDelay: `${enterDelayMs}ms` }}
    >
      <div
        // The ratio snaps once, when the image reports its natural size; the
        // image's own reveal covers the change, and interpolating aspect-ratio
        // would relayout the results grid on every frame of it.
        className='bg-muted/60 relative w-full overflow-hidden'
        style={{ aspectRatio: aspectCss }}
      >
        {!loaded && <div className='skeleton-shimmer absolute inset-0' />}
        <img
          src={props.url}
          alt={props.alt}
          className={cn(
            'absolute inset-0 size-full object-contain',
            loaded ? 'generation-image-reveal opacity-100' : 'opacity-0'
          )}
          referrerPolicy='no-referrer'
          loading='lazy'
          decoding='async'
          onLoad={(event) => {
            const img = event.currentTarget
            if (img.naturalWidth > 0 && img.naturalHeight > 0) {
              setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight })
            }
            setLoaded(true)
          }}
        />
        {props.onOpen && (
          <button
            type='button'
            className='absolute inset-0 z-[5] cursor-zoom-in'
            aria-label={t('View full image')}
            onClick={props.onOpen}
          />
        )}
        {sizeLabel && (
          <div
            className={cn(
              'pointer-events-none absolute top-2.5 left-2.5 z-10',
              'generation-size-badge'
            )}
          >
            <span className='bg-background/85 text-foreground/90 inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[11px] shadow-sm backdrop-blur-sm'>
              {sizeLabel}
            </span>
          </div>
        )}
        <div
          className={cn(
            'absolute inset-x-0 bottom-0 z-10 flex items-end justify-end gap-2 p-2.5',
            'pointer-events-none bg-gradient-to-t from-black/55 via-black/20 to-transparent',
            'opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100'
          )}
        >
          {props.onUseAsReference && (
            <Button
              type='button'
              size='sm'
              variant='secondary'
              className='bg-background/90 text-foreground hover:bg-background pointer-events-auto h-8 shadow-sm backdrop-blur'
              onClick={props.onUseAsReference}
            >
              <ImagePlus className='size-3.5' />
              {t('Edit')}
            </Button>
          )}
          <Button
            type='button'
            size='sm'
            variant='secondary'
            className='bg-background/90 text-foreground hover:bg-background pointer-events-auto h-8 shadow-sm backdrop-blur'
            disabled={props.downloading}
            onClick={handleDownload}
          >
            <DownloadActionIcon
              downloading={props.downloading}
              done={justDownloaded && !props.downloading}
            />
            {justDownloaded && !props.downloading ? t('Saved') : t('Download')}
          </Button>
        </div>
      </div>
      {props.caption && (
        <figcaption className='text-muted-foreground line-clamp-2 p-2.5 text-xs text-pretty'>
          {props.caption}
        </figcaption>
      )}
    </figure>
  )
}

function DownloadActionIcon(props: { downloading: boolean; done: boolean }) {
  if (props.downloading) {
    return <Loader2 className='size-3.5 animate-spin' />
  }
  if (props.done) {
    return <Check className='text-success size-3.5' />
  }
  return <Download className='size-3.5' />
}


