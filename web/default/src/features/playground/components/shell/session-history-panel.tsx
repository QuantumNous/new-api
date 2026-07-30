/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import {
  AudioLines,
  History,
  ImageIcon,
  MessageSquare,
  Pin,
  PinOff,
  Plus,
  Search,
  Trash2,
  Video,
  type LucideIcon,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import {
  selectActiveSession,
  usePlaygroundStore,
} from '@/stores/playground-store'

import {
  hasSessionContent,
  listSessionsForModality,
  type PlaygroundSession,
  type SessionModality,
} from '../../lib'

function formatRelativeTime(
  timestamp: number,
  t: (key: string, options?: Record<string, unknown>) => string
): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return ''
  const diffMs = Date.now() - timestamp
  if (diffMs < 60_000) return t('Just now')
  if (diffMs < 3_600_000) {
    const mins = Math.max(1, Math.round(diffMs / 60_000))
    return t('{{count}}m ago', { count: mins })
  }
  if (diffMs < 86_400_000) {
    const hours = Math.max(1, Math.round(diffMs / 3_600_000))
    return t('{{count}}h ago', { count: hours })
  }
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp))
}

const MODALITY_META: Record<
  SessionModality,
  { labelKey: string; Icon: LucideIcon }
> = {
  chat: { labelKey: 'Chats', Icon: MessageSquare },
  image: { labelKey: 'Image projects', Icon: ImageIcon },
  video: { labelKey: 'Video projects', Icon: Video },
  audio: { labelKey: 'Audio projects', Icon: AudioLines },
}

type SessionHistoryPanelProps = {
  className?: string
  /** Called after selecting a session (e.g. close mobile sheet). */
  onSelectSession?: () => void
  /** Compact header mode for embedding inside the left rail. */
  embedded?: boolean
}

export function SessionHistoryPanel(props: SessionHistoryPanelProps) {
  const { t } = useTranslation()
  const activeModality = usePlaygroundStore((state) => state.activeModality)
  const sessions = usePlaygroundStore((state) => state.sessions)
  const activeSession = usePlaygroundStore(selectActiveSession)
  const openSession = usePlaygroundStore((state) => state.openSession)
  const startNewSession = usePlaygroundStore((state) => state.startNewSession)
  const deleteSession = usePlaygroundStore((state) => state.deleteSession)
  const renameSession = usePlaygroundStore((state) => state.renameSession)
  const togglePinSession = usePlaygroundStore((state) => state.togglePinSession)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [query, setQuery] = useState('')

  const items = useMemo(() => {
    const list = listSessionsForModality(sessions, activeModality)
    const needle = query.trim().toLowerCase()
    if (!needle) return list
    return list.filter((session) => {
      if (session.title.toLowerCase().includes(needle)) return true
      if (session.model.toLowerCase().includes(needle)) return true
      return false
    })
  }, [sessions, activeModality, query])

  const meta = MODALITY_META[activeModality]
  const Icon = meta.Icon
  const newLabel = activeModality === 'chat' ? t('New chat') : t('New project')

  const handleRenameSubmit = (session: PlaygroundSession) => {
    const next = renameValue.trim()
    if (next && next !== session.title) {
      renameSession(session.id, next)
    }
    setRenamingId(null)
    setRenameValue('')
  }

  return (
    <div
      className={cn('flex h-full min-h-0 flex-col', props.className)}
      data-session-history=''
    >
      <div
        className={cn(
          'flex shrink-0 items-center gap-2 border-b border-border/60 px-3 py-2.5',
          props.embedded && 'bg-sidebar/40'
        )}
      >
        <span className='bg-primary/10 text-primary flex size-7 items-center justify-center rounded-lg'>
          <History className='size-3.5' aria-hidden='true' />
        </span>
        <div className='min-w-0 flex-1'>
          <p className='text-foreground truncate text-sm font-semibold'>
            {t('History')}
          </p>
          <p className='text-muted-foreground truncate text-[11px]'>
            {t(meta.labelKey)}
          </p>
        </div>
        <Button
          size='sm'
          className='h-8 shrink-0 gap-1 px-2.5'
          onClick={() => {
            startNewSession(activeModality)
            props.onSelectSession?.()
          }}
        >
          <Plus className='size-3.5' aria-hidden='true' />
          <span className='hidden sm:inline'>{newLabel}</span>
          <span className='sr-only sm:hidden'>{newLabel}</span>
        </Button>
      </div>

      <div className='border-border/60 shrink-0 border-b px-3 py-2'>
        <div className='relative'>
          <Search
            className='text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2'
            aria-hidden='true'
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('Search history')}
            aria-label={t('Search history')}
            className='border-border/60 bg-background/60 focus-visible:ring-ring h-8 w-full rounded-lg border pr-2 pl-8 text-sm outline-none focus-visible:ring-2'
          />
        </div>
      </div>

      <ScrollArea className='min-h-0 flex-1'>
        <div className='flex flex-col gap-0.5 p-2'>
          {items.length === 0 && query.trim() !== '' && (
            <div className='text-muted-foreground px-3 py-8 text-center text-xs'>
              {t('No sessions match your search.')}
            </div>
          )}
          {items.length === 0 && query.trim() === '' && (
            <div className='text-muted-foreground flex flex-col items-center gap-2 px-3 py-10 text-center text-xs'>
              <span className='bg-primary/10 text-primary flex size-10 items-center justify-center rounded-xl'>
                <Icon className='size-5' aria-hidden='true' />
              </span>
              <p>{t('No saved sessions yet')}</p>
              <p className='text-[11px] opacity-80'>
                {t('Start chatting or generating to build history here.')}
              </p>
            </div>
          )}

          {items.map((session) => {
            const active = activeSession?.id === session.id
            const subtitle = session.model || t('No model')
            const isRenaming = renamingId === session.id

            return (
              <div
                key={session.id}
                className={cn(
                  'group relative flex flex-col gap-0.5 rounded-xl border border-transparent px-2.5 py-2 transition-colors',
                  active
                    ? 'border-primary/30 bg-primary/10'
                    : 'hover:bg-muted/60'
                )}
              >
                {isRenaming ? (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault()
                      handleRenameSubmit(session)
                    }}
                    className='flex flex-col gap-1.5'
                  >
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(event) => setRenameValue(event.target.value)}
                      onBlur={() => handleRenameSubmit(session)}
                      className='border-border bg-background focus-visible:ring-ring h-8 rounded-md border px-2 text-sm outline-none focus-visible:ring-2'
                      aria-label={t('Session title')}
                    />
                  </form>
                ) : (
                  <button
                    type='button'
                    onClick={() => {
                      openSession(session.id)
                      props.onSelectSession?.()
                    }}
                    onDoubleClick={() => {
                      setRenamingId(session.id)
                      setRenameValue(session.title)
                    }}
                    className='min-w-0 text-left outline-none'
                  >
                    <span
                      className={cn(
                        'flex items-center gap-1 text-sm font-medium',
                        active ? 'text-primary' : 'text-foreground'
                      )}
                    >
                      {session.pinned && (
                        <Pin
                          className='text-primary size-3 shrink-0'
                          aria-label={t('Pinned')}
                        />
                      )}
                      <span className='truncate'>{session.title}</span>
                    </span>
                    <span className='text-muted-foreground mt-0.5 flex items-center gap-1.5 text-[11px]'>
                      <span className='truncate font-mono'>{subtitle}</span>
                      <span aria-hidden='true'>·</span>
                      <span className='shrink-0'>
                        {formatRelativeTime(session.updatedAt, t)}
                      </span>
                    </span>
                    {session.modality === 'image' &&
                      (session.previewUrls?.length ?? 0) > 0 && (
                        <span className='mt-1.5 flex items-center gap-1'>
                          {(session.previewUrls ?? [])
                            .slice(-3)
                            .map((url) => (
                              <img
                                key={url}
                                src={url}
                                alt=''
                                aria-hidden='true'
                                loading='lazy'
                                referrerPolicy='no-referrer'
                                className='border-border/60 size-9 rounded-md border object-cover'
                              />
                            ))}
                        </span>
                      )}
                  </button>
                )}

                {hasSessionContent(session) && !isRenaming && (
                  <div
                    className={cn(
                      'absolute top-1.5 right-1.5 flex items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100',
                      active && 'opacity-70'
                    )}
                  >
                    <button
                      type='button'
                      aria-label={session.pinned ? t('Unpin') : t('Pin')}
                      onClick={(event) => {
                        event.stopPropagation()
                        togglePinSession(session.id)
                      }}
                      className='text-muted-foreground hover:text-primary hover:bg-primary/10 focus-visible:ring-ring flex size-7 items-center justify-center rounded-md outline-none focus-visible:ring-2'
                    >
                      {session.pinned ? (
                        <PinOff className='size-3.5' aria-hidden='true' />
                      ) : (
                        <Pin className='size-3.5' aria-hidden='true' />
                      )}
                    </button>
                    <button
                      type='button'
                      aria-label={t('Delete session')}
                      onClick={(event) => {
                        event.stopPropagation()
                        setDeleteId(session.id)
                      }}
                      className='text-muted-foreground hover:text-destructive hover:bg-destructive/10 focus-visible:ring-ring flex size-7 items-center justify-center rounded-md outline-none focus-visible:ring-2'
                    >
                      <Trash2 className='size-3.5' aria-hidden='true' />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </ScrollArea>

      <ConfirmDialog
        destructive
        open={deleteId != null}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null)
        }}
        title={t('Delete this session?')}
        desc={t(
          'This removes the session from this browser. Cloud copies are deleted when synced.'
        )}
        confirmText={t('Delete')}
        handleConfirm={() => {
          if (deleteId) deleteSession(deleteId)
          setDeleteId(null)
        }}
      />
    </div>
  )
}
