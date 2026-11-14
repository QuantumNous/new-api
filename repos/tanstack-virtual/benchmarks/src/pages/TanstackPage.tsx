import { useEffect, useMemo, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  markFirstPaint,
  markMountEnd,
  markMountStart,
  registerHarness,
} from '../lib/harness'
import { makeDataset } from '../lib/dataset'
import type { ScenarioInput } from '../scenarios/types'

interface Props {
  scenario: ScenarioInput
}

export function TanstackPage({ scenario }: Props) {
  // Mount-start mark is set BEFORE this component renders by main.tsx.
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

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => scenario.itemSize,
    overscan: 5,
  })

  // Register the bench harness once we have a ref.
  useEffect(() => {
    registerHarness({
      getScrollContainer: () => parentRef.current,
      scrollToIndex: (i, opts) =>
        virtualizer.scrollToIndex(i, { align: opts?.align ?? 'start' }),
      getTotalSize: () => virtualizer.getTotalSize(),
      isFullyMeasured: () => {
        // For dynamic scenarios, all items must have a measured size in
        // measurementsCache (size differs from estimateSize). Because we
        // render with overscan only, "fully measured" here means: scroll
        // position reaches a steady state. We use cache size as a proxy.
        const sized = (virtualizer.measurementsCache ?? []).filter(
          (m) => m.size !== scenario.itemSize,
        ).length
        // For static scenarios there's nothing to wait on.
        if (!scenario.dynamic) return true
        // ~visible window size; dynamic mount only renders visible+overscan
        // so this is the right proxy for "done with first measurement pass".
        return sized > 0
      },
    })
    markMountEnd()
    markFirstPaint()
  }, [virtualizer, scenario.dynamic, scenario.itemSize])

  return (
    <div
      ref={parentRef}
      className="scroll-host"
      data-bench-scroll-host="tanstack"
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((vi) => {
          const item = items[vi.index]!
          return (
            <div
              key={vi.key}
              data-index={vi.index}
              ref={scenario.dynamic ? virtualizer.measureElement : undefined}
              className={'item ' + (vi.index % 2 === 0 ? 'even' : '')}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${vi.start}px)`,
                minHeight: scenario.dynamic ? undefined : scenario.itemSize,
              }}
            >
              {item.text}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Convenience: page-level wrapper that calls markMountStart synchronously.
// Used by main.tsx for every library.
export function TanstackPageRoot({ scenario }: Props) {
  markMountStart()
  return <TanstackPage scenario={scenario} />
}
