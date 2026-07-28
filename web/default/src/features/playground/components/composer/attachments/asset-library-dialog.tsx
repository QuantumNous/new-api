/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Trash2, Upload } from 'lucide-react'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'

import {
  deletePlaygroundAsset,
  listPlaygroundAssets,
  uploadPlaygroundAsset,
  type PlaygroundAsset,
} from '../../../api'

type AssetLibraryDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  kind?: string
  onSelect: (asset: PlaygroundAsset) => void
}

function acceptForKind(kind?: string): string {
  if (kind === 'video') return 'video/*'
  if (kind === 'audio') return 'audio/*'
  return 'image/*'
}

export function AssetLibraryDialog(props: AssetLibraryDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)

  const query = useQuery({
    queryKey: ['playground', 'assets', props.kind ?? 'all', 'library'],
    queryFn: () =>
      listPlaygroundAssets({
        kind: props.kind,
        source: 'library',
        page_size: 40,
      }),
    enabled: props.open,
  })

  const uploadMutation = useMutation({
    mutationFn: (files: File[]) =>
      Promise.all(
        files.map((file) => uploadPlaygroundAsset(file, props.kind, 'library'))
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['playground', 'assets'] })
      toast.success(t('Asset uploaded'))
    },
    onError: (err: Error) => {
      toast.error(err.message || t('Upload failed'))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deletePlaygroundAsset,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['playground', 'assets'] })
    },
  })

  const items = query.data?.items ?? []

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={t('Asset library')}
      description={t(
        'Pick a previously uploaded reference or upload a new file.'
      )}
      contentClassName='sm:max-w-lg border-border bg-popover text-foreground'
      footer={
        <Button variant='outline' onClick={() => props.onOpenChange(false)}>
          {t('Close')}
        </Button>
      }
    >
      <div className='space-y-3'>
        <div className='flex gap-2'>
          <Button
            type='button'
            size='sm'
            className='bg-primary text-primary-foreground hover:bg-primary/90'
            disabled={uploadMutation.isPending}
            onClick={() => inputRef.current?.click()}
          >
            {uploadMutation.isPending ? (
              <Loader2 className='size-3.5 animate-spin' />
            ) : (
              <Upload className='size-3.5' />
            )}
            {t('Upload')}
          </Button>
          <input
            ref={inputRef}
            type='file'
            accept={acceptForKind(props.kind)}
            multiple
            className='sr-only'
            onChange={(event) => {
              const files = [...(event.target.files ?? [])]
              if (files.length > 0) uploadMutation.mutate(files)
              event.target.value = ''
            }}
          />
        </div>

        {query.isLoading && (
          <p className='text-muted-foreground flex items-center gap-2 text-sm'>
            <Loader2 className='size-3.5 animate-spin' />
            {t('Loading…')}
          </p>
        )}

        {!query.isLoading && items.length === 0 && (
          <p className='text-muted-foreground py-6 text-center text-sm'>
            {t('No assets yet. Upload a file to get started.')}
          </p>
        )}

        <ul className='max-h-72 space-y-1.5 overflow-y-auto'>
          {items.map((asset) => (
            <li
              key={asset.id}
              className='border-border bg-muted/40 flex items-center gap-2 rounded-lg border p-2'
            >
              <button
                type='button'
                className='focus-visible:ring-ring flex min-w-0 flex-1 items-center gap-2 text-left outline-none focus-visible:ring-2'
                onClick={() => {
                  props.onSelect(asset)
                  props.onOpenChange(false)
                }}
              >
                {asset.kind === 'image' && asset.url ? (
                  <img
                    src={asset.url}
                    alt=''
                    className='size-10 shrink-0 rounded object-cover'
                  />
                ) : (
                  <span className='bg-muted/50 text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded text-[10px] uppercase'>
                    {asset.kind}
                  </span>
                )}
                <span className='min-w-0'>
                  <span className='text-foreground block truncate text-sm'>
                    {asset.name || `#${asset.id}`}
                  </span>
                  <span className='text-muted-foreground text-[11px]'>
                    {(asset.size / 1024).toFixed(0)} KB
                  </span>
                </span>
              </button>
              <Button
                type='button'
                variant='ghost'
                size='icon'
                className='text-muted-foreground hover:text-destructive size-8 shrink-0'
                aria-label={t('Delete')}
                onClick={() => deleteMutation.mutate(asset.id)}
              >
                <Trash2 className='size-3.5' />
              </Button>
            </li>
          ))}
        </ul>
      </div>
    </Dialog>
  )
}
