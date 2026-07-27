/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { History, LayoutGrid } from 'lucide-react'
import { useEffect, useState } from 'react'
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

type RailTab = 'models' | 'sessions'

function RailTabs(props: { value: RailTab; onChange: (tab: RailTab) => void }) {
  const { t } = useTranslation()
  const tabs: { key: RailTab; label: string; Icon: typeof History }[] = [
    { key: 'models', label: t('Models'), Icon: LayoutGrid },
    { key: 'sessions', label: t('Chats'), Icon: History },
  ]
  return (
    <div
      role='tablist'
      aria-label={t('Left panel')}
      className='border-sidebar-border bg-sidebar/60 flex shrink-0 gap-1 border-b p-1.5'
    >
      {tabs.map(({ key, label, Icon }) => {
        const active = props.value === key
        return (
          <button
            key={key}
            type='button'
            role='tab'
            aria-selected={active}
            onClick={() => props.onChange(key)}
            className={cn(
              'focus-visible:ring-ring flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition-colors outline-none focus-visible:ring-2',
              active
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}
          >
            <Icon className='size-3.5' aria-hidden='true' />
            {label}
          </button>
        )
      })}
    </div>
  )
}

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
 * Playground layout: toolbar, left rail with Models | Chats tabs (desktop),
 * workspace center, optional settings column. The model catalog stays the
 * default rail face (aggregator identity); the Chats tab hosts thread history.
 */
export function PlaygroundShell(props: PlaygroundShellProps) {
  const { t } = useTranslation()
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const { catalogOpen, onCatalogOpenChange, historyOpen, onHistoryOpenChange } =
    props
  const [railTab, setRailTab] = useState<RailTab>('models')

  // Close the mobile catalog sheet when crossing the breakpoint. On desktop
  // the header history button focuses the rail's Chats tab instead of a sheet.
  useEffect(() => {
    if (isDesktop && catalogOpen) onCatalogOpenChange(false)
  }, [isDesktop, catalogOpen, onCatalogOpenChange])

  useEffect(() => {
    if (isDesktop && historyOpen) {
      setRailTab('sessions')
      onHistoryOpenChange(false)
    }
  }, [isDesktop, historyOpen, onHistoryOpenChange])

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
            <RailTabs value={railTab} onChange={setRailTab} />
            <div
              className={cn('min-h-0 flex-1', railTab !== 'models' && 'hidden')}
            >
              {props.catalog}
            </div>
            {railTab === 'sessions' && (
              <div className='min-h-0 flex-1'>
                <SessionHistoryPanel embedded />
              </div>
            )}
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
            {catalogOpen && (
              <>
                <RailTabs value={railTab} onChange={setRailTab} />
                <div
                  className={cn(
                    'min-h-0 flex-1',
                    railTab !== 'models' && 'hidden'
                  )}
                >
                  {props.catalog}
                </div>
                {railTab === 'sessions' && (
                  <div className='min-h-0 flex-1'>
                    <SessionHistoryPanel
                      embedded
                      onSelectSession={() => onCatalogOpenChange(false)}
                    />
                  </div>
                )}
              </>
            )}
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
