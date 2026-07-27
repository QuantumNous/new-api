/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useMediaQuery } from '@/hooks/use-media-query'
import { cn } from '@/lib/utils'

import { SessionHistoryPanel } from './session-history-panel'

type PlaygroundShellProps = {
  catalog: React.ReactNode
  /** Right settings column (desktop only) */
  settings?: React.ReactNode
  catalogOpen: boolean
  onCatalogOpenChange: (open: boolean) => void
  historyOpen: boolean
  onHistoryOpenChange: (open: boolean) => void
  children: React.ReactNode
  className?: string
}

/**
 * Playground layout: toolbar, left model catalog (desktop), workspace center,
 * optional settings column. History opens from the workspace header icon as a
 * side sheet on every breakpoint — no History | Models tab bar.
 */
export function PlaygroundShell(props: PlaygroundShellProps) {
  const { t } = useTranslation()
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const { catalogOpen, onCatalogOpenChange, historyOpen, onHistoryOpenChange } =
    props

  // Desktop keeps the model catalog in the left rail; close the mobile catalog
  // sheet when crossing the breakpoint. History is always a sheet.
  useEffect(() => {
    if (isDesktop && catalogOpen) onCatalogOpenChange(false)
  }, [isDesktop, catalogOpen, onCatalogOpenChange])

  const handleCatalogOpen = (open: boolean) => {
    if (open) onHistoryOpenChange(false)
    onCatalogOpenChange(open)
  }
  const handleHistoryOpen = (open: boolean) => {
    if (open) onCatalogOpenChange(false)
    onHistoryOpenChange(open)
  }

  return (
    <div
      className={cn(
        'playground-workbench bg-background text-foreground relative flex size-full min-h-0 flex-col overflow-hidden',
        'pb-[env(safe-area-inset-bottom,0px)]',
        props.className
      )}
      data-playground-workbench=''
    >
      <div className='relative flex min-h-0 flex-1'>
        {isDesktop && (
          <aside className='playground-rail bg-sidebar/95 text-sidebar-foreground border-sidebar-border flex w-[min(300px,28vw)] shrink-0 flex-col border-r backdrop-blur-md'>
            <div className='min-h-0 flex-1'>{props.catalog}</div>
          </aside>
        )}

        <main className='playground-stage relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden'>
          {props.children}
        </main>

        {isDesktop && props.settings}
      </div>

      <Sheet open={!isDesktop && catalogOpen} onOpenChange={handleCatalogOpen}>
        <SheetContent
          side='left'
          className='bg-sidebar text-sidebar-foreground border-sidebar-border w-[min(92vw,22rem)] p-0 sm:max-w-sm'
        >
          <SheetHeader className='sr-only'>
            <SheetTitle>{t('Model catalog')}</SheetTitle>
            <SheetDescription>
              {t('Choose a model for your next run.')}
            </SheetDescription>
          </SheetHeader>
          <div className='flex h-full flex-col pt-[env(safe-area-inset-top,0px)]'>
            {catalogOpen && props.catalog}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={historyOpen} onOpenChange={handleHistoryOpen}>
        <SheetContent
          side='right'
          className='bg-sidebar text-sidebar-foreground border-sidebar-border w-[min(92vw,22rem)] p-0 sm:max-w-sm'
        >
          <SheetHeader className='sr-only'>
            <SheetTitle>{t('History')}</SheetTitle>
            <SheetDescription>
              {t('Browse and switch between your sessions.')}
            </SheetDescription>
          </SheetHeader>
          <div className='flex h-full flex-col pt-[env(safe-area-inset-top,0px)]'>
            {historyOpen && (
              <SessionHistoryPanel
                onSelectSession={() => onHistoryOpenChange(false)}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
