/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { handleServerError } from '@/lib/handle-server-error'

import { getChannelPriorityOrder, reorderChannelPriority } from '../api'
import { channelsQueryKeys } from '../lib'
import {
  applyPriorityPreview,
  previewPriorityDrop,
  type PriorityDrop,
  type PriorityMove,
  type PriorityOrder,
} from '../lib/channel-priority-order'
import type { Channel } from '../types'

export function useChannelPriorityOrder(props: {
  channels: Channel[]
  desc: boolean
  scope: string
  enabled: boolean
}) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const [optimisticDrop, setOptimisticDrop] = useState<PriorityDrop | null>(
    null
  )
  const [savedPreview, setSavedPreview] = useState<PriorityOrder | null>(null)
  // Only the status strip subscribes to hover/priority-preview updates. The table's
  // data and row objects stay unchanged throughout the pointer gesture.
  const [previewStore] = useState(() => {
    const listeners = new Set<() => void>()
    let value: {
      drop: PriorityDrop | null
      preview: PriorityOrder | null
      preparing: boolean
    } = { drop: null, preview: null, preparing: false }
    return {
      getSnapshot: () => value,
      subscribe: (listener: () => void) => {
        listeners.add(listener)
        return () => {
          listeners.delete(listener)
        }
      },
      publish: (next: typeof value) => {
        value = next
        for (const listener of listeners) listener()
      },
    }
  })
  const [undo, setUndo] = useState<PriorityOrder | null>(null)
  const [active, setActive] = useState(false)
  const [saving, setSaving] = useState(false)
  const session = useRef<{
    snapshot: Promise<PriorityOrder>
    drop: PriorityDrop | null
    serial: number
  } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const mutation = useMutation({
    mutationFn: reorderChannelPriority,
    meta: { errorToast: false },
  })
  const busy = useRef(false)

  const cancel = useCallback(() => {
    clearTimeout(timer.current)
    session.current = null
    setActive(false)
    setOptimisticDrop(null)
    setSavedPreview(null)
    previewStore.publish({ drop: null, preview: null, preparing: false })
  }, [previewStore])

  function begin() {
    if (!props.enabled || busy.current) return
    cancel()
    // Read a fresh snapshot on every gesture, including keyboard moves.
    const snapshot = getChannelPriorityOrder()
    // Mark rejection handled until the gesture actually needs the result.
    void snapshot.catch(() => undefined)
    session.current = { snapshot, drop: null, serial: 0 }
    setActive(true)
  }

  function select(next: PriorityDrop | null) {
    const current = session.current
    if (!current || busy.current) return
    clearTimeout(timer.current)
    current.drop = next
    current.serial++
    previewStore.publish({ drop: next, preview: null, preparing: !!next })
    if (!next) return
    const serial = current.serial
    timer.current = setTimeout(() => {
      void current.snapshot
        .then((snapshot) => {
          if (
            session.current !== current ||
            current.serial !== serial ||
            busy.current
          ) {
            return null
          }
          return reorderChannelPriority({
            ...next,
            revision: snapshot.revision,
            preview: true,
          })
        })
        .then((result) => {
          if (
            result &&
            session.current === current &&
            current.serial === serial &&
            !busy.current
          ) {
            previewStore.publish({
              drop: next,
              preview: result,
              preparing: false,
            })
          }
        })
        .catch((error: unknown) => {
          if (
            session.current === current &&
            current.serial === serial &&
            !busy.current
          ) {
            cancel()
            handleServerError(error)
          }
        })
    }, 200)
  }

  async function save(move: PriorityMove) {
    const result = await mutation.mutateAsync(move)
    setSavedPreview(result)
    await client.invalidateQueries({ queryKey: channelsQueryKeys.lists() })
    setUndo(move.restore ? null : result)
    if (result.changes.length > 0) toast.success(t('Channel priorities saved'))
  }

  async function commit() {
    const current = session.current
    if (busy.current) return
    if (!current?.drop) {
      cancel()
      return
    }
    busy.current = true
    setSaving(true)
    clearTimeout(timer.current)
    setOptimisticDrop(current.drop)
    previewStore.publish({ drop: current.drop, preview: null, preparing: true })
    try {
      const snapshot = await current.snapshot
      if (session.current !== current) return
      await save({ ...current.drop, revision: snapshot.revision })
    } catch (error) {
      handleServerError(error)
      await client.invalidateQueries({ queryKey: channelsQueryKeys.lists() })
    } finally {
      busy.current = false
      setSaving(false)
      cancel()
    }
  }

  async function restore() {
    if (!undo || busy.current) return
    busy.current = true
    setSaving(true)
    try {
      await save({
        revision: undo.revision,
        restore: undo.changes.map((change) => ({
          id: change.id,
          previous: change.priority,
          priority: change.previous,
        })),
      })
    } catch (error) {
      setUndo(null)
      handleServerError(error)
      await client.invalidateQueries({ queryKey: channelsQueryKeys.lists() })
    } finally {
      busy.current = false
      setSaving(false)
      cancel()
    }
  }

  useEffect(() => {
    cancel()
    // View/filter/page changes cancel a pending gesture, but not an in-flight save.
  }, [props.scope, props.enabled, cancel])
  useEffect(
    () => () => {
      clearTimeout(timer.current)
      session.current = null
    },
    []
  )

  const items = useMemo(() => {
    if (savedPreview) {
      return applyPriorityPreview(props.channels, savedPreview, props.desc)
    }
    if (optimisticDrop) {
      return previewPriorityDrop(props.channels, optimisticDrop, props.desc)
    }
    return props.channels
  }, [props.channels, props.desc, optimisticDrop, savedPreview])

  return {
    items,
    previewStore,
    active,
    saving,
    undo,
    begin,
    select,
    commit,
    cancel,
    restore,
  }
}
