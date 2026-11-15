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
import {
  animate,
  type AnimationPlaybackControls,
  type ValueAnimationTransition,
} from 'motion'
import { useReducedMotion } from 'motion/react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'

import {
  previewPriorityDrop,
  type PriorityDrop,
  type PriorityPosition,
} from '../lib/channel-priority-order'
import type { Channel } from '../types'
import type { useChannelPriorityOrder } from './use-channel-priority-order'

function scrollParent(element: HTMLElement): HTMLElement {
  let parent = element.parentElement
  while (parent) {
    if (/(auto|scroll)/.test(getComputedStyle(parent).overflowY)) return parent
    parent = parent.parentElement
  }
  return document.documentElement
}

function animateDragTransform(
  element: HTMLElement,
  transform: string,
  transition: ValueAnimationTransition<string>
): AnimationPlaybackControls {
  // Animate the value directly so Motion cannot reapply a DOM transform after
  // cleanup and React's final reorder have restored the row's natural position.
  return animate(
    element.style.transform || 'translate3d(0px, 0px, 0px)',
    transform,
    {
      ...transition,
      onUpdate: (value) => {
        element.style.transform = value
      },
    }
  )
}

type DragOptions = {
  items: Channel[]
  desc: boolean
  enabled: boolean
  scope: string
  begin: () => void
  select: (drop: PriorityDrop | null) => void
  commit: () => Promise<void>
  cancel: () => void
  previewStore: ReturnType<typeof useChannelPriorityOrder>['previewStore']
}

type DragSlot = {
  id: number
  element: HTMLElement
  rect: DOMRect
  transform: string
  minHeight: string
  willChange: string
  boxShadow: string
  backgroundColor: string
  x: number
  y: number
}

type DragPoint = {
  pointerId: number
  id: number
  startX: number
  startY: number
  x: number
  y: number
  moved: boolean
  clone: HTMLElement | null
  overlay: HTMLElement | null
  feedback: HTMLElement | null
  insertion: HTMLElement | null
  insertionY: number | null
  drop: PriorityDrop | null
  source: HTMLElement
  opacity: string
  outline: string
  scroller: HTMLElement
  scrollBounds: DOMRect
  rootBounds: DOMRect
  target: string
  slots: DragSlot[]
  slotsByID: Map<number, DragSlot>
  items: Channel[]
  ordered: Channel[]
  hitIndex: number
  hitTarget: number | null
  horizontal: boolean
  table: boolean
  destination: DOMRect | null
  scrollTop: number
  scrollLeft: number
  lastFrame: number
  commit: boolean
}

/** The gesture keeps React rows and DOM order fixed. Only transforms change. */
export function useChannelPriorityDrag(options: DragOptions) {
  const root = useRef<HTMLDivElement>(null)
  const point = useRef<DragPoint | null>(null)
  const [feedbackContainer, setFeedbackContainer] =
    useState<HTMLElement | null>(null)
  const frame = useRef<number | undefined>(undefined)
  const released = useRef<DragPoint | null>(null)
  const landing = useRef<AnimationPlaybackControls | null>(null)
  const animations = useRef(new Map<HTMLElement, AnimationPlaybackControls>())
  const latest = useRef(options)
  latest.current = options
  const reduced = useReducedMotion()
  const transition = useMemo(
    () =>
      reduced
        ? { duration: 0 }
        : { type: 'spring' as const, stiffness: 450, damping: 38 },
    [reduced]
  )

  const clearVisuals = useCallback((current: DragPoint) => {
    current.overlay?.remove()
    setFeedbackContainer(null)
    current.source.style.opacity = current.opacity
    current.source.style.outline = current.outline
    for (const slot of current.slots) {
      animations.current.get(slot.element)?.stop()
      Object.assign(slot.element.style, {
        transform: slot.transform,
        minHeight: slot.minHeight,
        willChange: slot.willChange,
        boxShadow: slot.boxShadow,
        backgroundColor: slot.backgroundColor,
      })
      delete slot.element.dataset.priorityDrop
    }
    animations.current.clear()
    if (root.current) delete root.current.dataset.priorityDragging
    released.current = null
  }, [])

  const preview = useCallback(
    (current: DragPoint, drop: PriorityDrop | null, settling = false) => {
      const ordered = drop
        ? previewPriorityDrop(current.items, drop, latest.current.desc)
        : current.items
      current.ordered = ordered
      current.drop = drop
      if (current.clone) {
        current.clone.style.outline =
          drop && drop.position !== 'same'
            ? '1px solid var(--warning)'
            : '1px solid var(--primary)'
      }
      const targetPriority =
        current.items.find((item) => item.id === drop?.target_id)?.priority ?? 0
      current.insertionY = null
      if (current.table && drop && drop.position !== 'same') {
        const tierIDs = new Set(
          current.items
            .filter(
              (item) =>
                item.id !== current.id &&
                (item.priority ?? 0) === targetPriority
            )
            .map((item) => item.id)
        )
        const tier = current.slots.filter((slot) => tierIDs.has(slot.id))
        const before = (drop.position === 'before') === latest.current.desc
        current.insertionY =
          (before ? tier[0]?.rect.top : tier.at(-1)?.rect.bottom) ?? null
      }
      for (const [index, item] of ordered.entries()) {
        const slot = current.slotsByID.get(item.id)
        const destination = current.slots[index]?.rect
        if (!slot || !destination) continue
        const joining =
          drop?.position === 'same' &&
          item.id !== current.id &&
          (item.priority ?? 0) === targetPriority
        if (joining) slot.element.dataset.priorityDrop = 'same'
        else delete slot.element.dataset.priorityDrop
        slot.element.style.boxShadow = joining
          ? 'inset 0 0 0 2px var(--primary)'
          : slot.boxShadow
        if (current.table) {
          slot.element.style.backgroundColor = joining
            ? 'color-mix(in srgb, var(--primary) 8%, var(--card))'
            : slot.backgroundColor
        }
        const x = destination.left - slot.rect.left
        const y = destination.top - slot.rect.top
        if (item.id === current.id) current.destination = destination
        // Table rows remain stable hit targets; animate the result on release.
        if (current.table && !settling) continue
        if (slot.x === x && slot.y === y) continue
        slot.x = x
        slot.y = y
        const transform = `translate3d(${x}px, ${y}px, 0)`
        animations.current.get(slot.element)?.stop()
        if (item.id === current.id) {
          if (!current.table) slot.element.style.transform = transform
        } else if (transition.duration === 0) {
          slot.element.style.transform = transform
        } else {
          animations.current.set(
            slot.element,
            animateDragTransform(slot.element, transform, transition)
          )
        }
      }
    },
    [transition]
  )

  const stop = useCallback(
    (commit = false) => {
      const current = point.current
      if (!current) {
        if (released.current && !commit) {
          released.current.commit = false
          landing.current?.complete()
        }
        return
      }
      point.current = null
      if (frame.current !== undefined) cancelAnimationFrame(frame.current)
      frame.current = undefined
      if (root.current?.hasPointerCapture(current.pointerId)) {
        root.current.releasePointerCapture(current.pointerId)
      }
      if (!current.moved || !current.clone) return
      if (current.feedback) current.feedback.hidden = true
      if (current.insertion) current.insertion.hidden = true
      current.commit = commit && !!current.target
      released.current = current
      if (transition.duration === 0) {
        clearVisuals(current)
        if (current.commit) void latest.current.commit()
        else latest.current.cancel()
        return
      }
      if (current.table) {
        if (current.overlay) current.overlay.hidden = true
        if (!current.commit) {
          clearVisuals(current)
          latest.current.cancel()
          return
        }
        current.source.style.opacity = current.opacity
        preview(current, current.drop, true)
        const source = current.slotsByID.get(current.id)
        if (!source) {
          clearVisuals(current)
          latest.current.cancel()
          return
        }
        landing.current = animateDragTransform(
          current.source,
          `translate3d(${source.x}px, ${source.y}px, 0)`,
          {
            ...transition,
            onComplete: () => {
              clearVisuals(current)
              if (current.commit) void latest.current.commit()
              else latest.current.cancel()
            },
          }
        )
        return
      }
      if (!current.commit) preview(current, null)
      const origin = current.slotsByID.get(current.id)?.rect
      const target = current.destination ?? origin
      if (!origin || !target) {
        clearVisuals(current)
        latest.current.cancel()
        return
      }
      const x =
        target.left -
        origin.left -
        current.scroller.scrollLeft +
        current.scrollLeft
      const y =
        target.top - origin.top - current.scroller.scrollTop + current.scrollTop
      landing.current = animateDragTransform(
        current.clone,
        `translate3d(${x}px, ${y}px, 0)`,
        {
          ...transition,
          onComplete: () => {
            clearVisuals(current)
            // Commit changes React's order exactly once, after the visual landing.
            if (current.commit) void latest.current.commit()
            else latest.current.cancel()
          },
        }
      )
    },
    [clearVisuals, preview, transition]
  )

  const tick = useCallback(
    (time: number) => {
      frame.current = undefined
      const current = point.current
      if (!current || !root.current) return
      if (!current.moved) {
        if (
          Math.hypot(current.x - current.startX, current.y - current.startY) <=
          4
        ) {
          return
        }
        // Batch every layout read before adding the ghost or writing styles.
        const elements = [
          ...root.current.querySelectorAll<HTMLElement>(
            '[data-sortable-id^="channel:"]'
          ),
        ]
        current.slots = elements.map((element) => ({
          id: Number(element.dataset.sortableId?.split(':')[1]),
          element,
          rect: element.getBoundingClientRect(),
          transform: element.style.transform,
          minHeight: element.style.minHeight,
          willChange: element.style.willChange,
          boxShadow: element.style.boxShadow,
          backgroundColor: element.style.backgroundColor,
          x: 0,
          y: 0,
        }))
        current.slotsByID = new Map(
          current.slots.map((slot) => [slot.id, slot])
        )
        const origin = current.slotsByID.get(current.id)?.rect
        if (!origin) return
        current.table = current.source.tagName === 'TR'
        current.scrollBounds = current.scroller.getBoundingClientRect()
        current.rootBounds = root.current.getBoundingClientRect()
        current.scrollTop = current.scroller.scrollTop
        current.scrollLeft = current.scroller.scrollLeft
        current.horizontal =
          !current.table &&
          current.slots.some(
            (slot, index) =>
              index > 0 &&
              Math.abs(
                slot.rect.top - (current.slots[index - 1]?.rect.top ?? Infinity)
              ) < 4
          )
        current.destination = origin
        current.moved = true
        latest.current.begin()

        let clone: HTMLElement
        if (current.table) {
          clone = document.createElement('div')
          const identity = document.createElement('div')
          identity.className =
            'flex min-w-0 items-center gap-2 px-3 pt-3 text-sm'
          const name = document.createElement('span')
          name.className = 'min-w-0 flex-1 truncate font-medium'
          // Read displayed text so the preview respects the visibility toggle.
          name.textContent =
            current.source.querySelector('[data-column-id="name"]')
              ?.textContent ?? ''
          const priority = document.createElement('span')
          priority.dataset.columnId = 'priority'
          priority.className =
            'text-muted-foreground shrink-0 font-mono text-xs'
          const value = document.createElement('span')
          value.dataset.slot = 'numeric-spinner-value'
          value.textContent =
            current.source.querySelector(
              '[data-column-id="priority"] [data-slot="numeric-spinner-value"]'
            )?.textContent ?? ''
          priority.append(value)
          identity.append(name, priority)
          clone.append(identity)
        } else clone = current.source.cloneNode(true) as HTMLElement
        clone.style.animation = 'none'
        clone.removeAttribute('id')
        clone.removeAttribute('data-sortable-id')
        clone
          .querySelectorAll('[id]')
          .forEach((element) => element.removeAttribute('id'))
        const ghost = clone
        ghost.dataset.originX = String(origin.left)
        ghost.dataset.originY = String(origin.top)
        Object.assign(ghost.style, {
          position: 'absolute',
          left: current.table ? '0' : `${origin.left}px`,
          top: current.table ? '0' : `${origin.top}px`,
          margin: '0',
          width: current.table ? '300px' : `${origin.width}px`,
          maxWidth: 'calc(100vw - 16px)',
          height: current.table ? 'auto' : `${origin.height}px`,
          pointerEvents: 'none',
          background: 'var(--card)',
          borderRadius: 'var(--radius)',
          boxShadow: '0 12px 28px #0003',
          outline: '1px solid var(--primary)',
          overflow: 'hidden',
          willChange: 'transform',
        })
        const overlay = document.createElement('div')
        Object.assign(overlay.style, {
          position: 'fixed',
          inset: '0',
          overflow: 'hidden',
          pointerEvents: 'none',
          zIndex: '1000',
        })
        overlay.setAttribute('aria-hidden', 'true')
        overlay.inert = true
        const insertion = document.createElement('div')
        insertion.dataset.priorityInsertion = ''
        insertion.hidden = true
        Object.assign(insertion.style, {
          position: 'absolute',
          left: '0',
          top: '0',
          background: 'var(--warning)',
          borderRadius: '999px',
          boxShadow: '0 0 0 2px var(--background)',
          pointerEvents: 'none',
        })
        const feedback = document.createElement('div')
        Object.assign(feedback.style, {
          position: current.table ? 'relative' : 'absolute',
          left: '0',
          top: '0',
          width: '300px',
          maxWidth: 'calc(100vw - 16px)',
          pointerEvents: 'none',
          willChange: 'transform',
        })
        if (current.table) {
          feedback.dataset.priorityView = 'table'
          ghost.append(feedback)
          overlay.append(insertion, ghost)
        } else overlay.append(ghost, insertion, feedback)
        document.body.append(overlay)
        current.feedback = feedback
        current.insertion = insertion
        setFeedbackContainer(feedback)
        current.overlay = overlay
        current.clone = ghost
        for (const slot of current.slots) {
          slot.element.style.willChange = 'transform'
          if (slot.element.tagName !== 'TR') {
            slot.element.style.minHeight = `${slot.rect.height}px`
          }
        }
        current.source.style.opacity = '0.2'
        current.source.style.outline = '2px dashed var(--primary)'
        root.current.dataset.priorityDragging = 'true'
      }
      // No geometry reads, sorting or React table updates in the pointer frame.
      const scrollBefore = current.scroller.scrollTop
      const bounds = current.scrollBounds
      const elapsed = current.lastFrame
        ? Math.min(32, time - current.lastFrame)
        : 16
      current.lastFrame = time
      if (current.x >= bounds.left && current.x <= bounds.right) {
        if (current.y < bounds.top + 32) {
          current.scroller.scrollTop -= elapsed * 0.45
        } else if (current.y > bounds.bottom - 32) {
          current.scroller.scrollTop += elapsed * 0.45
        }
      }
      const scrollX = current.scroller.scrollLeft - current.scrollLeft
      const scrollY = current.scroller.scrollTop - current.scrollTop
      const pointerX = current.x + scrollX
      const pointerY = current.y + scrollY
      let hitIndex = -1
      let distance = Infinity
      for (const [index, slot] of current.slots.entries()) {
        const dx = pointerX - slot.rect.left - slot.rect.width / 2
        const dy = pointerY - slot.rect.top - slot.rect.height / 2
        const squared = dx * dx + dy * dy
        if (squared < distance) {
          hitIndex = index
          distance = squared
        }
      }
      let next: PriorityDrop | null = null
      const slot = current.slots[hitIndex]
      if (
        slot &&
        pointerX >= slot.rect.left - 8 &&
        pointerX <= slot.rect.right + 8 &&
        pointerY >= slot.rect.top - 8 &&
        pointerY <= slot.rect.bottom + 8 &&
        current.x >= current.rootBounds.left &&
        current.x <= current.rootBounds.right &&
        current.y >= current.rootBounds.top &&
        current.y <= current.rootBounds.bottom
      ) {
        if (current.table) {
          current.hitIndex = hitIndex
          current.hitTarget = slot.id === current.id ? null : slot.id
        } else if (hitIndex !== current.hitIndex) {
          current.hitIndex = hitIndex
          const occupant = current.ordered[hitIndex]
          // Resolve the card/row now occupying this slot, not its original ID.
          // A moving placeholder retains the previous target instead of resetting.
          if (occupant && occupant.id !== current.id) {
            current.hitTarget = occupant.id
          }
        }
        if (current.hitTarget !== null) {
          const offset = current.horizontal
            ? pointerX - slot.rect.left
            : pointerY - slot.rect.top
          const size = current.horizontal ? slot.rect.width : slot.rect.height
          const edge = Math.min(current.table ? 10 : 24, size * 0.18)
          const leading: PriorityPosition = latest.current.desc
            ? 'before'
            : 'after'
          const trailing: PriorityPosition = latest.current.desc
            ? 'after'
            : 'before'
          let leadingEdge = edge
          let trailingEdge = size - edge
          if (current.drop?.target_id === current.hitTarget) {
            leadingEdge += current.drop.position === leading ? 3 : -3
            trailingEdge += current.drop.position === trailing ? -3 : 3
          }
          let position: PriorityPosition = 'same'
          if (offset < leadingEdge) position = leading
          else if (offset > trailingEdge) position = trailing
          next = { id: current.id, target_id: current.hitTarget, position }
        }
      } else {
        current.hitIndex = -1
        current.hitTarget = null
      }
      if (current.clone && !current.table) {
        current.clone.style.transform = `translate3d(${current.x - current.startX}px, ${current.y - current.startY}px, 0)`
      }
      const key = next ? `${next.target_id}:${next.position}` : ''
      if (key !== current.target) {
        current.target = key
        preview(current, next)
        latest.current.select(next)
      }
      if (current.feedback) {
        const left = Math.max(
          8,
          Math.min(current.x + 16, window.innerWidth - 308)
        )
        const top = Math.max(
          8,
          Math.min(
            current.table ? current.y - 132 : current.y + 20,
            window.innerHeight - 148
          )
        )
        const floating = current.table ? current.clone : current.feedback
        if (floating) {
          floating.style.transform = `translate3d(${left}px, ${top}px, 0)`
        }
      }
      const destination = current.destination
      if (current.insertion) {
        current.insertion.hidden =
          !current.drop || current.drop.position === 'same' || !destination
        if (!current.insertion.hidden && destination) {
          const left = destination.left - scrollX
          const top = (current.insertionY ?? destination.top) - scrollY
          const vertical = current.horizontal
          Object.assign(current.insertion.style, {
            transform: `translate3d(${vertical ? left - 6 : Math.max(left, current.scrollBounds.left)}px, ${vertical ? top : top - 2}px, 0)`,
            width: vertical
              ? '4px'
              : `${Math.min(destination.right - scrollX, current.scrollBounds.right) - Math.max(left, current.scrollBounds.left)}px`,
            height: vertical ? `${destination.height}px` : '4px',
          })
        }
      }
      // Idle pointers do not run a perpetual frame loop. Continue only to scroll.
      if (current.scroller.scrollTop !== scrollBefore) {
        frame.current = requestAnimationFrame(tick)
      }
    },
    [preview]
  )

  const start = useCallback(
    (event: PointerEvent<HTMLButtonElement>, id: number) => {
      if (
        !latest.current.enabled ||
        point.current ||
        released.current ||
        event.button !== 0
      ) {
        return
      }
      const source = root.current?.querySelector<HTMLElement>(
        `[data-sortable-id="channel:${id}"]`
      )
      if (!source || !root.current) return
      event.preventDefault()
      event.currentTarget.focus({ preventScroll: true })
      point.current = {
        pointerId: event.pointerId,
        id,
        startX: event.clientX,
        startY: event.clientY,
        x: event.clientX,
        y: event.clientY,
        moved: false,
        clone: null,
        overlay: null,
        feedback: null,
        insertion: null,
        insertionY: null,
        drop: null,
        source,
        opacity: source.style.opacity,
        outline: source.style.outline,
        scroller: scrollParent(source),
        scrollBounds: new DOMRect(),
        rootBounds: new DOMRect(),
        target: '',
        slots: [],
        slotsByID: new Map(),
        items: latest.current.items,
        ordered: latest.current.items,
        hitIndex: -1,
        hitTarget: null,
        horizontal: false,
        table: false,
        destination: null,
        scrollTop: 0,
        scrollLeft: 0,
        lastFrame: 0,
        commit: false,
      }
      root.current.setPointerCapture(event.pointerId)
    },
    []
  )

  const keyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, id: number) => {
      if (event.key === 'Escape') {
        stop()
        latest.current.cancel()
        return
      }
      if (!latest.current.enabled || point.current || released.current) return
      const index = latest.current.items.findIndex((item) => item.id === id)
      let delta = 0
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') delta = -1
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') delta = 1
      if (!delta) return
      event.preventDefault()
      const target = latest.current.items[index + delta]
      if (!target) return
      latest.current.begin()
      latest.current.select({
        id,
        target_id: target.id,
        position: delta < 0 === latest.current.desc ? 'before' : 'after',
      })
      void latest.current.commit()
    },
    [stop]
  )

  useEffect(
    () =>
      options.previewStore.subscribe(() => {
        const current = point.current ?? released.current
        if (!current?.clone) return
        const { drop, preview } = options.previewStore.getSnapshot()
        let priority =
          current.items.find((item) => item.id === current.id)?.priority ?? 0
        if (drop?.id === current.id) {
          if (drop.position === 'same') {
            priority =
              current.items.find((item) => item.id === drop.target_id)
                ?.priority ?? 0
          }
          if (preview) {
            priority =
              preview.items.find((item) => item.id === current.id)?.priority ??
              priority
          }
        }
        const value = current.clone.querySelector<HTMLElement>(
          '[data-column-id="priority"] [data-slot="numeric-spinner-value"]'
        )
        if (value instanceof HTMLInputElement) value.value = String(priority)
        else if (value) {
          value.textContent = String(priority)
          value.title = String(priority)
        }
      }),
    [options.previewStore]
  )

  useEffect(() => {
    stop()
  }, [options.scope, options.enabled, stop])
  useEffect(() => {
    const cancel = () => stop()
    const key = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') cancel()
    }
    window.addEventListener('blur', cancel)
    window.addEventListener('resize', cancel)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('blur', cancel)
      window.removeEventListener('resize', cancel)
      window.removeEventListener('keydown', key)
      if (frame.current !== undefined) cancelAnimationFrame(frame.current)
      if (released.current) released.current.commit = false
      landing.current?.stop()
      if (point.current) clearVisuals(point.current)
      if (released.current) clearVisuals(released.current)
      point.current = null
    }
  }, [clearVisuals, stop])

  return {
    root,
    feedbackContainer,
    start,
    keyDown,
    rootEvents: {
      onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
        if (point.current?.pointerId !== event.pointerId) return
        point.current.x = event.clientX
        point.current.y = event.clientY
        if (frame.current === undefined) {
          frame.current = requestAnimationFrame(tick)
        }
      },
      onPointerUp: (event: PointerEvent<HTMLDivElement>) => {
        if (point.current?.pointerId !== event.pointerId) return
        point.current.x = event.clientX
        point.current.y = event.clientY
        if (frame.current !== undefined) cancelAnimationFrame(frame.current)
        tick(performance.now())
        stop(true)
      },
      onPointerCancel: () => {
        if (point.current) stop()
      },
      onLostPointerCapture: () => {
        if (point.current) stop()
      },
    },
  }
}
