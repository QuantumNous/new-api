import { useEffect, useMemo, useRef } from 'react'
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso'
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

export function VirtuosoPage({ scenario }: Props) {
  const items = useMemo(
    () =>
      makeDataset(
        scenario.count,
        scenario.dynamic,
        scenario.action === 'jump-wide-variance-accuracy',
      ),
    [scenario.count, scenario.dynamic, scenario.action],
  )

  const ref = useRef<VirtuosoHandle>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const measuredRef = useRef(0)

  useEffect(() => {
    registerHarness({
      getScrollContainer: () => {
        // Virtuoso owns its own scroll container internally.
        return (
          (hostRef.current?.querySelector(
            '[data-testid="virtuoso-scroller"]',
          ) as HTMLElement | null) ?? hostRef.current
        )
      },
      scrollToIndex: (i, opts) =>
        ref.current?.scrollToIndex({
          index: i,
          align: opts?.align === 'end' ? 'end' : 'start',
          behavior: 'auto',
        }),
      getTotalSize: () => {
        // Virtuoso renders a tall inner div; read its height.
        const scroller = hostRef.current?.querySelector(
          '[data-testid="virtuoso-scroller"]',
        ) as HTMLElement | null
        return scroller?.scrollHeight ?? 0
      },
      isFullyMeasured: () => {
        if (!scenario.dynamic) return true
        return measuredRef.current >= 10
      },
    })
    markMountEnd()
    markFirstPaint()
  }, [scenario.dynamic])

  return (
    <div
      ref={hostRef}
      className="scroll-host"
      data-bench-scroll-host="virtuoso"
    >
      <Virtuoso
        ref={ref}
        style={{ height: '100%' }}
        totalCount={items.length}
        rangeChanged={(r) => {
          measuredRef.current = Math.max(measuredRef.current, r.endIndex)
        }}
        fixedItemHeight={scenario.dynamic ? undefined : scenario.itemSize}
        itemContent={(i) => {
          const item = items[i]!
          return (
            <div
              data-index={i}
              className={'item ' + (i % 2 === 0 ? 'even' : '')}
              style={{
                minHeight: scenario.dynamic ? undefined : scenario.itemSize,
              }}
            >
              {item.text}
            </div>
          )
        }}
      />
    </div>
  )
}

export function VirtuosoPageRoot({ scenario }: Props) {
  markMountStart()
  return <VirtuosoPage scenario={scenario} />
}
