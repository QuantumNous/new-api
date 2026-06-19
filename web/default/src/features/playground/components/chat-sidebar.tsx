/*
Copyright (C) 2023-2026 QuantumNous
*/
import { useState, useEffect, useCallback } from 'react'
import {
  PlusIcon,
  MessageSquareIcon,
  Trash2Icon,
  PencilIcon,
  CheckIcon,
  XIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
} from '@/components/ui/sheet'
import {
  getChatSessions,
  deleteChatSession,
  updateChatTitle,
  type ChatSession,
} from '../api'

interface ChatSidebarProps {
  currentSessionId: string | null
  onSelectSession: (sessionId: string) => void
  onNewChat: () => void
  model: string
  group: string
  collapsed: boolean
  onToggleCollapse: () => void
  mobileOpen?: boolean
  onMobileOpenChange?: (open: boolean) => void
  /** Register a refresh callback so parent can trigger sidebar reload */
  onRefresh?: (refreshFn: () => void) => void
}

// ─── Shared session list UI ──────────────────────────────────────────────────

interface SessionListProps {
  sessions: ChatSession[]
  currentSessionId: string | null
  editingId: string | null
  editTitle: string
  t: (key: string) => string
  onSelect: (id: string) => void
  onDelete: (id: string, e: React.MouseEvent) => void
  onStartEdit: (session: ChatSession, e: React.MouseEvent) => void
  onSaveEdit: (e: React.MouseEvent) => void
  onCancelEdit: (e: React.MouseEvent) => void
  onEditTitleChange: (title: string) => void
}

function SessionList({
  sessions,
  currentSessionId,
  editingId,
  editTitle,
  t,
  onSelect,
  onDelete,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onEditTitleChange,
}: SessionListProps) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayTs = today.getTime() / 1000
  const yesterdayTs = todayTs - 86400

  const todaySessions = sessions.filter((s) => s.updated_at >= todayTs)
  const yesterdaySessions = sessions.filter(
    (s) => s.updated_at >= yesterdayTs && s.updated_at < todayTs
  )
  const olderSessions = sessions.filter((s) => s.updated_at < yesterdayTs)

  const renderSession = (session: ChatSession) => {
    const isActive = session.id === currentSessionId
    const isEditing = session.id === editingId
    // Clean display title — strip markdown image syntax and leading ?/spaces
    const displayTitle = (session.title || '')
      .replace(/!\[image\]\([^)]+\)/g, '')
      .replace(/^\?+\s*/, '')
      .trim() || t('Untitled')

    return (
      <div
        key={session.id}
        onClick={() => onSelect(session.id)}
        className={`group flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm cursor-pointer transition-colors ${
          isActive
            ? 'bg-accent text-accent-foreground'
            : 'hover:bg-muted/50 text-muted-foreground'
        }`}
      >
        <MessageSquareIcon size={14} className='shrink-0 opacity-50' />
        {isEditing ? (
          <div
            className='flex flex-1 items-center gap-1'
            onClick={(e) => e.stopPropagation()}
          >
            <input
              autoFocus
              className='flex-1 rounded bg-background px-1 text-sm border outline-none'
              value={editTitle}
              onChange={(e) => onEditTitleChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter')
                  onSaveEdit(e as unknown as React.MouseEvent)
                if (e.key === 'Escape')
                  onCancelEdit(e as unknown as React.MouseEvent)
              }}
            />
            <button
              onClick={onSaveEdit}
              className='p-0.5 hover:text-green-500'
            >
              <CheckIcon size={12} />
            </button>
            <button
              onClick={onCancelEdit}
              className='p-0.5 hover:text-red-500'
            >
              <XIcon size={12} />
            </button>
          </div>
        ) : (
          <>
            <span className='flex-1 truncate'>
              {displayTitle}
            </span>
            <div className='hidden group-hover:flex items-center gap-0.5'>
              <button
                onClick={(e) => onStartEdit(session, e)}
                className='p-0.5 rounded hover:bg-accent'
              >
                <PencilIcon size={12} />
              </button>
              <button
                onClick={(e) => onDelete(session.id, e)}
                className='p-0.5 rounded hover:bg-destructive/10 hover:text-destructive'
              >
                <Trash2Icon size={12} />
              </button>
            </div>
          </>
        )}
      </div>
    )
  }

  const renderGroup = (label: string, items: ChatSession[]) => {
    if (items.length === 0) return null
    return (
      <div className='space-y-0.5'>
        <div className='px-2.5 py-1 text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider'>
          {label}
        </div>
        {items.map(renderSession)}
      </div>
    )
  }

  if (sessions.length === 0) {
    return (
      <div className='px-3 py-8 text-center text-xs text-muted-foreground/50'>
        {t('No chat history yet')}
      </div>
    )
  }

  return (
    <div className='flex-1 overflow-y-auto p-2 space-y-3'>
      {renderGroup(t('Today'), todaySessions)}
      {renderGroup(t('Yesterday'), yesterdaySessions)}
      {renderGroup(t('Previous'), olderSessions)}
    </div>
  )
}

// ─── Main ChatSidebar ─────────────────────────────────────────────────────────

export function ChatSidebar({
  currentSessionId,
  onSelectSession,
  onNewChat,
  collapsed,
  onToggleCollapse,
  onRefresh,
  mobileOpen = false,
  onMobileOpenChange,
}: ChatSidebarProps) {
  const { t } = useTranslation()
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')

  const loadSessions = useCallback(async () => {
    const data = await getChatSessions()
    setSessions(data || [])
  }, [])

  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  // Expose refresh function to parent
  useEffect(() => {
    onRefresh?.(loadSessions)
  }, [onRefresh, loadSessions])

  const handleNewChat = () => {
    onNewChat()
    onMobileOpenChange?.(false)
  }

  const handleSelectSession = (id: string) => {
    onSelectSession(id)
    onMobileOpenChange?.(false)
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const ok = await deleteChatSession(id)
    if (ok) {
      setSessions((prev) => prev.filter((s) => s.id !== id))
      if (currentSessionId === id) onNewChat()
      toast.success(t('Chat deleted'))
    }
  }

  const handleStartEdit = (session: ChatSession, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingId(session.id)
    setEditTitle(session.title)
  }

  const handleSaveEdit = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!editingId || !editTitle.trim()) return
    await updateChatTitle(editingId, editTitle.trim())
    setSessions((prev) =>
      prev.map((s) =>
        s.id === editingId ? { ...s, title: editTitle.trim() } : s
      )
    )
    setEditingId(null)
  }

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingId(null)
  }

  const sessionListProps: SessionListProps = {
    sessions,
    currentSessionId,
    editingId,
    editTitle,
    t,
    onSelect: handleSelectSession,
    onDelete: handleDelete,
    onStartEdit: handleStartEdit,
    onSaveEdit: handleSaveEdit,
    onCancelEdit: handleCancelEdit,
    onEditTitleChange: setEditTitle,
  }

  // ── Mobile: floating Sheet drawer ─────────────────────────────────────────

  const MobileSheet = (
    <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
      <SheetContent
        side='left'
        showCloseButton={false}
        className='w-72 p-0 gap-0 border-0 rounded-r-2xl shadow-2xl'
      >
        {/* Header */}
        <div className='flex items-center justify-between border-b p-3'>
          <span className='text-sm font-semibold'>{t('Chat History')}</span>
          <div className='flex items-center gap-1'>
            <Button
              variant='outline'
              size='sm'
              onClick={handleNewChat}
              className='gap-1.5 text-xs'
            >
              <PlusIcon size={14} />
              {t('New Chat')}
            </Button>
          </div>
        </div>
        <div className='flex-1 overflow-y-auto'>
          <SessionList {...sessionListProps} />
        </div>
      </SheetContent>
    </Sheet>
  )

  // ── Desktop: collapsed icon bar ───────────────────────────────────────────

  if (collapsed) {
    return (
      <>
        {MobileSheet}
        <div className='hidden md:flex flex-col items-center border-r py-3 px-1 gap-2'>
          <Button
            variant='ghost'
            size='icon'
            onClick={onToggleCollapse}
            className='h-8 w-8'
          >
            <PanelLeftOpenIcon size={16} />
          </Button>
          <Button
            variant='ghost'
            size='icon'
            onClick={handleNewChat}
            className='h-8 w-8'
          >
            <PlusIcon size={16} />
          </Button>
        </div>
      </>
    )
  }

  // ── Desktop: full sidebar ─────────────────────────────────────────────────

  return (
    <>
      {/* Mobile floating sheet (always rendered, hidden on desktop) */}
      {MobileSheet}

      {/* Desktop sidebar (hidden on mobile) */}
      <div className='hidden md:flex w-64 flex-col border-r bg-background/50'>
        <div className='flex items-center justify-between p-3 border-b'>
          <Button
            variant='outline'
            size='sm'
            onClick={handleNewChat}
            className='flex-1 gap-1.5 text-xs'
          >
            <PlusIcon size={14} />
            {t('New Chat')}
          </Button>
          <Button
            variant='ghost'
            size='icon'
            onClick={onToggleCollapse}
            className='ml-2 h-7 w-7'
          >
            <PanelLeftCloseIcon size={14} />
          </Button>
        </div>

        <div className='flex-1 overflow-y-auto p-2 space-y-3'>
          <SessionList {...sessionListProps} />
        </div>
      </div>
    </>
  )
}

// ─── Mobile toggle button (exported for use in header) ───────────────────────

export function ChatSidebarMobileToggle({
  onClick,
}: {
  onClick: () => void
}) {
  return (
    <Button
      variant='ghost'
      size='icon'
      className='md:hidden h-8 w-8'
      onClick={onClick}
    >
      <PanelLeftOpenIcon size={18} />
      <span className='sr-only'>Chat History</span>
    </Button>
  )
}
