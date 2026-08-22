import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { GripVertical, Loader2, RotateCcw, Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getLobeIcon } from '@/lib/lobe-icon'
import { cn } from '@/lib/utils'

import { getAllModelsForReorder, reorderModels } from '../api'
import { modelsQueryKeys } from '../lib/query-keys'
import type { Model, Vendor } from '../types'

/**
 * Sort a model list the same way the pricing page does: `0` means "unset"
 * and sorts last; positive values sort ascending; ties break by name.
 * See model/pricing.go for the authoritative ordering this mirrors.
 */
function sortByRank(models: Model[]): Model[] {
  return [...models].sort((a, b) => {
    const sa = a.sort_order ?? 0
    const sb = b.sort_order ?? 0
    if (sa === 0 && sb === 0) {
      return (a.model_name ?? '').localeCompare(b.model_name ?? '')
    }
    if (sa === 0) return 1
    if (sb === 0) return -1
    if (sa !== sb) return sa - sb
    return (a.model_name ?? '').localeCompare(b.model_name ?? '')
  })
}

function ModelRowContent({
  model,
  rank,
  vendorMap,
  isMatch,
  isOverlay,
}: {
  model: Model
  rank: number
  vendorMap: Record<number, Vendor>
  isMatch: boolean
  isOverlay?: boolean
}) {
  const iconKey =
    model.icon ||
    vendorMap[model.vendor_id || 0]?.icon ||
    model.model_name?.[0] ||
    'N'

  return (
    <div
      className={cn(
        'bg-card flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-opacity',
        !isMatch && 'opacity-40',
        isOverlay && 'ring-primary/20 shadow-xl ring-2'
      )}
    >
      <span className='text-muted-foreground w-8 shrink-0 text-right font-mono text-xs tabular-nums'>
        {rank}
      </span>
      <div className='flex size-5 shrink-0 items-center justify-center overflow-hidden'>
        {getLobeIcon(`${iconKey.split('.')[0]}.Avatar.type={'platform'}`, 20)}
      </div>
      <span className='min-w-0 truncate font-mono text-sm'>
        {model.model_name}
      </span>
    </div>
  )
}

function ModelRowWithHandle({
  model,
  rank,
  vendorMap,
  isMatch,
  isOverlay,
  handleProps,
}: {
  model: Model
  rank: number
  vendorMap: Record<number, Vendor>
  isMatch: boolean
  isOverlay?: boolean
  handleProps?: React.HTMLAttributes<HTMLButtonElement>
}) {
  const { t } = useTranslation()

  return (
    <div className='flex items-center gap-3'>
      <button
        type='button'
        className='text-muted-foreground hover:text-foreground cursor-grab touch-none active:cursor-grabbing'
        aria-label={t('Drag to reorder')}
        {...handleProps}
      >
        <GripVertical className='size-4' />
      </button>
      <div className='min-w-0 flex-1'>
        <ModelRowContent
          model={model}
          rank={rank}
          vendorMap={vendorMap}
          isMatch={isMatch}
          isOverlay={isOverlay}
        />
      </div>
    </div>
  )
}

function SortableModelRow({
  model,
  rank,
  vendorMap,
  isMatch,
}: {
  model: Model
  rank: number
  vendorMap: Record<number, Vendor>
  isMatch: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: model.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(isDragging && 'invisible')}
    >
      <ModelRowWithHandle
        model={model}
        rank={rank}
        vendorMap={vendorMap}
        isMatch={isMatch}
        handleProps={{ ...attributes, ...listeners }}
      />
    </div>
  )
}

export function ModelsReorderView({
  vendors,
  onExit,
}: {
  vendors: Vendor[]
  onExit: () => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [items, setItems] = useState<Model[]>([])
  const [activeId, setActiveId] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)
  const initialOrderRef = useRef<Array<{ id: number; sort_order: number }>>(
    []
  )
  const hasLoadedRef = useRef(false)
  const dragStartSnapshotRef = useRef<Model[] | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: modelsQueryKeys.reorderList(),
    queryFn: getAllModelsForReorder,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })

  useEffect(() => {
    // Seed local state once from the initial fetch only. A background
    // refetch must never silently discard in-progress local edits.
    if (data?.data && !hasLoadedRef.current) {
      hasLoadedRef.current = true
      const sorted = sortByRank(data.data)
      setItems(sorted)
      initialOrderRef.current = sorted.map((m) => ({
        id: m.id,
        sort_order: m.sort_order ?? 0,
      }))
    }
  }, [data])

  const hasChanges = useMemo(() => {
    if (items.length !== initialOrderRef.current.length) return true
    return items.some(
      (m, i) =>
        m.id !== initialOrderRef.current[i]?.id ||
        (m.sort_order ?? 0) !== initialOrderRef.current[i]?.sort_order
    )
  }, [items])

  const vendorMap = useMemo(() => {
    const map: Record<number, Vendor> = {}
    vendors.forEach((v) => {
      map[v.id] = v
    })
    return map
  }, [vendors])

  const matchedIds = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return null
    const matched = new Set<number>()
    items.forEach((m) => {
      if (m.model_name?.toLowerCase().includes(query)) {
        matched.add(m.id)
      }
    })
    return matched
  }, [items, searchQuery])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  )

  const mutation = useMutation({
    mutationFn: reorderModels,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: modelsQueryKeys.lists() })
      onExit()
    },
    onError: () => {
      toast.error(t('Failed to save order'))
    },
  })

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as number)
    dragStartSnapshotRef.current = items
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    setItems((current) => {
      const oldIndex = current.findIndex((m) => m.id === active.id)
      const newIndex = current.findIndex((m) => m.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return current
      return arrayMove(current, oldIndex, newIndex)
    })
  }

  function handleDragEnd() {
    setActiveId(null)
    dragStartSnapshotRef.current = null
    setItems((current) =>
      current.map((m, index) => ({ ...m, sort_order: index + 1 }))
    )
  }

  function handleDragCancel() {
    setActiveId(null)
    if (dragStartSnapshotRef.current) {
      setItems(dragStartSnapshotRef.current)
      dragStartSnapshotRef.current = null
    }
  }

  function handleResetConfirm() {
    const alphabetical = [...items].sort((a, b) =>
      (a.model_name ?? '').localeCompare(b.model_name ?? '')
    )
    setItems(alphabetical.map((m) => ({ ...m, sort_order: 0 })))
    setResetConfirmOpen(false)
  }

  function handleDone() {
    if (!hasChanges) {
      onExit()
      return
    }
    mutation.mutate(
      items.map((m) => ({ id: m.id, sort_order: m.sort_order ?? 0 }))
    )
  }

  const activeModel = activeId != null
    ? items.find((m) => m.id === activeId)
    : undefined
  const activeRank = activeModel
    ? items.findIndex((m) => m.id === activeId) + 1
    : 0

  if (isLoading) {
    return (
      <div className='flex h-full min-h-0 flex-1 items-center justify-center'>
        <Loader2 className='text-muted-foreground size-6 animate-spin' />
      </div>
    )
  }

  return (
    <div className='flex h-full min-h-0 flex-col gap-3'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div className='bg-muted/50 text-muted-foreground rounded-lg border px-3 py-2 text-xs'>
          {t("Drag to reorder. The number on the left is the model's rank.")}
        </div>
        <div className='flex items-center gap-2'>
          <div className='relative w-56'>
            <Search className='text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t('Search models...')}
              className='pl-9'
              aria-label={t('Search models...')}
            />
          </div>
          <Button
            variant='outline'
            size='sm'
            onClick={() => setResetConfirmOpen(true)}
          >
            <RotateCcw className='size-4' />
            {t('Reset')}
          </Button>
        </div>
      </div>

      <div className='min-h-0 flex-1 overflow-y-auto'>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <SortableContext
            items={items.map((m) => m.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className='flex flex-col gap-2'>
              {items.map((model, index) => (
                <SortableModelRow
                  key={model.id}
                  model={model}
                  rank={index + 1}
                  vendorMap={vendorMap}
                  isMatch={!matchedIds || matchedIds.has(model.id)}
                />
              ))}
            </div>
          </SortableContext>

          {/*
            Rendered via a portal to document.body: the app's page-transition
            wrapper (see page-transition.tsx AnimatedOutlet) sets an inline
            `transform` on an ancestor during route animation. Any ancestor
            with a non-`none` transform becomes the containing block for
            `position: fixed` descendants, which silently breaks
            DragOverlay's viewport-relative positioning (renders offset and
            shrunk). Escaping to `document.body` sidesteps that ancestor
            chain entirely.
          */}
          {createPortal(
            <DragOverlay>
              {activeModel ? (
                <ModelRowWithHandle
                  model={activeModel}
                  rank={activeRank}
                  vendorMap={vendorMap}
                  isMatch
                  isOverlay
                />
              ) : null}
            </DragOverlay>,
            document.body
          )}
        </DndContext>
      </div>

      <div className='flex justify-end'>
        <Button size='sm' onClick={handleDone} disabled={mutation.isPending}>
          {mutation.isPending && (
            <Loader2 className='size-4 animate-spin' />
          )}
          {hasChanges ? t('Save & Done') : t('Done')}
        </Button>
      </div>

      <ConfirmDialog
        open={resetConfirmOpen}
        onOpenChange={setResetConfirmOpen}
        title={t('Reset sort order?')}
        desc={t(
          'This clears custom sort order for all models and reverts to alphabetical order. Takes effect after you click Done.'
        )}
        destructive
        handleConfirm={handleResetConfirm}
        confirmText={t('Reset')}
      />
    </div>
  )
}
