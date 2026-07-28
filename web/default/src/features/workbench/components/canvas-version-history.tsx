/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  sideDrawerContentClassName,
  sideDrawerHeaderClassName,
} from '@/components/drawer-layout'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Spinner } from '@/components/ui/spinner'

import { getCanvasVersion, listCanvasVersions } from '../api'
import { useCanvasStore } from '../store/canvas-store'
import type { CanvasDocument } from '../types'

type CanvasVersionHistoryProps = {
  projectId: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CanvasVersionHistory(props: CanvasVersionHistoryProps) {
  const { t, i18n } = useTranslation()
  const [restoringId, setRestoringId] = useState<number | null>(null)

  const versions = useQuery({
    queryKey: ['workbench', 'canvas-versions', props.projectId],
    queryFn: () => listCanvasVersions(props.projectId),
    enabled: props.open,
  })

  const sortedVersions = [...(versions.data ?? [])].sort(
    (a, b) => b.created_at - a.created_at
  )

  async function handleRestore(versionId: number) {
    setRestoringId(versionId)
    try {
      const version = await getCanvasVersion(props.projectId, versionId)
      let doc: Partial<CanvasDocument> | null = null
      try {
        doc = version.doc ? (JSON.parse(version.doc) as CanvasDocument) : null
      } catch {
        throw new Error('invalid version document')
      }
      useCanvasStore.getState().loadDocument(doc, { userRestore: true })
      props.onOpenChange(false)
      toast.success(t('Version restored'))
    } catch {
      toast.error(t('Failed to restore version'))
    } finally {
      setRestoringId(null)
    }
  }

  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent
        side='right'
        className={sideDrawerContentClassName('sm:max-w-md')}
      >
        <SheetHeader className={sideDrawerHeaderClassName()}>
          <SheetTitle>{t('Version history')}</SheetTitle>
        </SheetHeader>
        <div className='flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5'>
          {versions.isLoading ? (
            <div className='flex justify-center py-12'>
              <Spinner />
            </div>
          ) : null}

          {!versions.isLoading && !sortedVersions.length ? (
            <p className='text-muted-foreground py-8 text-center text-sm'>
              {t('No versions yet')}
            </p>
          ) : null}

          {sortedVersions.map((version) => (
            <div
              key={version.id}
              className='border-border flex items-start justify-between gap-3 rounded-lg border p-3'
            >
              <div className='min-w-0 flex-1'>
                <p className='truncate text-sm font-medium'>
                  {version.title || t('Untitled version')}
                </p>
                <p className='text-muted-foreground mt-1 text-xs'>
                  {new Date(version.created_at * 1000).toLocaleString(
                    i18n.language
                  )}
                </p>
              </div>
              <Button
                size='sm'
                variant='outline'
                disabled={restoringId !== null}
                onClick={() => void handleRestore(version.id)}
              >
                {restoringId === version.id ? <Spinner /> : null}
                {t('Restore')}
              </Button>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}
