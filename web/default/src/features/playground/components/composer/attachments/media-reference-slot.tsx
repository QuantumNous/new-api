/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { ImagePlus, Library, QrCode, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import {
  createUploadSession,
  getUploadSession,
  type PlaygroundAsset,
} from '../../../api'
import { AssetLibraryDialog } from './asset-library-dialog'

export type MediaReference = {
  id: string
  name: string
  dataUrl: string
  file?: File
  assetId?: number
}

type MediaReferenceSlotProps = {
  label: string
  value: MediaReference[]
  onChange: (value: MediaReference[]) => void
  accept?: string
  className?: string
  /** When false, file is kept in UI only (backend may not accept it yet). */
  attachable?: boolean
  kind?: 'image' | 'video' | 'audio'
  maxFiles?: number
}

export function MediaReferenceSlot(props: MediaReferenceSlotProps) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const attachable = props.attachable !== false
  const maxFiles = props.maxFiles ?? 1
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [qrPolling, setQrPolling] = useState(false)

  const handleFiles = async (files: File[]) => {
    const remaining = maxFiles - props.value.length
    if (remaining <= 0) {
      toast.error(
        t('You can attach up to {{count}} images.', { count: maxFiles })
      )
      return
    }

    const validFiles = files.filter((file) => {
      if (
        !file.type.startsWith('image/') &&
        props.kind !== 'audio' &&
        props.kind !== 'video'
      ) {
        toast.error(t('Please choose an image file.'))
        return false
      }
      // Align with backend PlaygroundAssetMaxImageBytes (10MB)
      if (file.size > 10 * 1024 * 1024 && file.type.startsWith('image/')) {
        toast.error(t('Image must be under 10MB.'))
        return false
      }
      return true
    })
    const acceptedFiles = validFiles.slice(0, remaining)
    if (validFiles.length > remaining) {
      toast.error(
        t('You can attach up to {{count}} images.', { count: maxFiles })
      )
    }

    try {
      const references = await Promise.all(
        acceptedFiles.map(
          (file) =>
            new Promise<MediaReference>((resolve, reject) => {
              const reader = new FileReader()
              reader.addEventListener(
                'load',
                () => {
                  const dataUrl = String(reader.result ?? '')
                  if (!dataUrl) {
                    reject(new Error('empty data URL'))
                    return
                  }
                  resolve({
                    id: crypto.randomUUID(),
                    name: file.name,
                    dataUrl,
                    file,
                  })
                },
                { once: true }
              )
              reader.addEventListener('error', () => reject(reader.error), {
                once: true,
              })
              reader.readAsDataURL(file)
            })
        )
      )
      props.onChange([...props.value, ...references])
      if (!attachable && references.length > 0) {
        toast.info(t('Reference saved locally'), {
          description: t(
            'This model path may not send reference media yet. The file stays ready in the workbench.'
          ),
        })
      }
    } catch {
      toast.error(t('Could not read the selected image.'))
    }
  }

  const selectAsset = (asset: PlaygroundAsset) => {
    if (props.value.length >= maxFiles) {
      toast.error(
        t('You can attach up to {{count}} images.', { count: maxFiles })
      )
      return
    }
    props.onChange([
      ...props.value,
      {
        id: `asset-${asset.id}`,
        name: asset.name || `asset-${asset.id}`,
        dataUrl: asset.url,
        assetId: asset.id,
      },
    ])
  }

  const startQrSession = async () => {
    try {
      setQrPolling(true)
      const session = await createUploadSession(props.kind ?? 'image')
      toast.info(t('Scan to upload'), {
        description: t(
          'Session ready for {{minutes}} min. Upload from another device to: {{url}}',
          {
            minutes: 15,
            url: session.upload_url,
          }
        ),
        duration: 12_000,
      })
      // poll for completed upload
      const deadline = Date.now() + 15 * 60 * 1000
      const poll = async () => {
        if (Date.now() > deadline) {
          setQrPolling(false)
          return
        }
        try {
          const status = await getUploadSession(session.token)
          if (status.asset) {
            selectAsset(status.asset)
            toast.success(t('Asset received from upload session'))
            setQrPolling(false)
            return
          }
        } catch {
          // keep polling
        }
        window.setTimeout(() => void poll(), 2500)
      }
      void poll()
    } catch (err) {
      setQrPolling(false)
      toast.error(
        err instanceof Error
          ? err.message
          : t('Could not create upload session')
      )
    }
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-1', props.className)}>
      <button
        type='button'
        onClick={() => inputRef.current?.click()}
        className={cn(
          'inline-flex h-8 items-center gap-1.5 rounded-lg border border-transparent px-2 text-[11px] font-medium transition-colors',
          'outline-none focus-visible:ring-2 focus-visible:ring-ring',
          props.value.length > 0
            ? 'border-primary/40 bg-primary/10 text-primary'
            : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
        )}
        aria-label={props.label}
      >
        <ImagePlus className='size-3.5' aria-hidden='true' />
        <span className='max-w-24 truncate'>{props.label}</span>
        {props.value.length > 0 && (
          <span className='tabular-nums'>({props.value.length})</span>
        )}
      </button>
      {props.value.map((reference, index) => (
        <span
          key={reference.id}
          className='group/reference relative size-8 shrink-0'
        >
          <img
            src={reference.dataUrl}
            alt={reference.name}
            className='border-border size-8 rounded-md border object-cover'
          />
          <button
            type='button'
            className='bg-background/90 text-foreground focus-visible:ring-ring absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full shadow-sm outline-none focus-visible:ring-2'
            aria-label={`${t('Remove reference')}: ${reference.name}`}
            onClick={() =>
              props.onChange(
                props.value.filter((_, itemIndex) => itemIndex !== index)
              )
            }
          >
            <X className='size-2.5' aria-hidden='true' />
          </button>
        </span>
      ))}
      <Button
        type='button'
        variant='ghost'
        size='icon'
        className='text-muted-foreground hover:bg-muted/70 hover:text-foreground size-8'
        aria-label={t('Asset library')}
        onClick={() => setLibraryOpen(true)}
      >
        <Library className='size-3.5' />
      </Button>
      <Button
        type='button'
        variant='ghost'
        size='icon'
        className='text-muted-foreground hover:bg-muted/70 hover:text-foreground size-8'
        aria-label={t('Scan to upload')}
        disabled={qrPolling}
        onClick={() => void startQrSession()}
      >
        <QrCode className='size-3.5' />
      </Button>
      <input
        ref={inputRef}
        type='file'
        accept={props.accept ?? 'image/*'}
        multiple={maxFiles > 1}
        className='sr-only'
        onChange={(event) => {
          void handleFiles([...(event.target.files ?? [])])
          event.target.value = ''
        }}
      />
      <AssetLibraryDialog
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        kind={props.kind ?? 'image'}
        onSelect={selectAsset}
      />
    </div>
  )
}
