import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  markFirstPaint,
  markMountEnd,
  markMountStart,
  registerHarness,
} from '../lib/harness'
import { ItemRow } from '../lib/itemRow'
import { makeDataset } from '../lib/dataset'
import type { ScenarioInput } from '../scenarios/types'

interface Props {
  scenario: ScenarioInput
}

/**
 * TanStack virtualizer + WAI-ARIA listbox/option roles on plain DOM.
 * Isolates headless virtualizer cost without React Aria collection building.
 */
export function TanstackRacPage({ scenario }: Props) {
  const items = useMemo(
    () =>
      makeDataset(
        scenario.count,
        scenario.dynamic,
        scenario.action === 'jump-wide-variance-accuracy',
      ),
    [scenario.count, scenario.dynamic, scenario.action],
  )

  const parentRef = useRef<HTMLDivElement>(null)
  const measuredIndexesRef = useRef<Set<number>>(new Set())

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => scenario.itemSize,
    overscan: 5,
  })

  const measureElement = useCallback(
    (element: HTMLDivElement | null) => {
      if (element) {
        const index = Number(element.dataset.index)
        if (Number.isFinite(index)) {
          measuredIndexesRef.current.add(index)
        }
      }
      virtualizer.measureElement(element)
    },
    [virtualizer],
  )

  useEffect(() => {
    registerHarness({
      getScrollContainer: () => parentRef.current,
      scrollToIndex: (i, opts) =>
        virtualizer.scrollToIndex(i, { align: opts?.align ?? 'start' }),
      getTotalSize: () => virtualizer.getTotalSize(),
      isFullyMeasured: () => {
        if (!scenario.dynamic) return true
        const virtualItems = virtualizer.getVirtualItems()
        return (
          virtualItems.length > 0 &&
          virtualItems.every((vi) => measuredIndexesRef.current.has(vi.index))
        )
      },
    })
    markMountEnd()
    markFirstPaint()
  }, [virtualizer, scenario.dynamic, scenario.itemSize])

  return (
    <div
      ref={parentRef}
      className="scroll-host"
      data-bench-scroll-host="tanstack-rac"
      role="listbox"
      aria-label="benchmark list"
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((vi) => {
          const item = items[vi.index]
          if (item == null) return null
          return (
            <div
              key={vi.key}
              role="option"
              data-index={vi.index}
              ref={scenario.dynamic ? measureElement : undefined}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${vi.start}px)`,
                height: scenario.dynamic ? undefined : scenario.itemSize,
              }}
            >
              <ItemRow
                item={item}
                index={vi.index}
                itemSize={scenario.itemSize}
                dynamic={scenario.dynamic}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function TanstackRacPageRoot({ scenario }: Props) {
  markMountStart()
  return <TanstackRacPage scenario={scenario} />
}
