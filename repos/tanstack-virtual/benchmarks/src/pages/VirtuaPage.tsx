import { useEffect, useMemo, useRef } from 'react'
import { VList, type VListHandle } from 'virtua'
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

export function VirtuaPage({ scenario }: Props) {
  const items = useMemo(
    () =>
      makeDataset(
        scenario.count,
        scenario.dynamic,
        scenario.action === 'jump-wide-variance-accuracy',
      ),
    [scenario.count, scenario.dynamic, scenario.action],
  )

  const ref = useRef<VListHandle>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const measuredSet = useRef(new Set<number>())

  useEffect(() => {
    registerHarness({
      getScrollContainer: () => hostRef.current,
      scrollToIndex: (i, opts) =>
        ref.current?.scrollToIndex(i, {
          align: opts?.align ?? 'start',
        }),
      getTotalSize: () => {
        // VList sets scrollSize implicitly on its sized inner div; prefer
        // that node's scrollHeight, then firstElementChild, then host.
        const el = hostRef.current?.querySelector(
          '[style*="height:"]',
        ) as HTMLElement | null
        return (
          el?.scrollHeight ??
          (hostRef.current?.firstElementChild as HTMLElement | null)
            ?.scrollHeight ??
          hostRef.current?.scrollHeight ??
          0
        )
      },
      isFullyMeasured: () => {
        if (!scenario.dynamic) return true
        // virtua measures items as they enter viewport; "fully measured" is a
        // proxy: at least the visible window has been observed once.
        return measuredSet.current.size >= 10
      },
    })
    markMountEnd()
    markFirstPaint()
  }, [scenario.dynamic])

  return (
    <div ref={hostRef} className="scroll-host" data-bench-scroll-host="virtua">
      <VList
        ref={ref}
        style={{ height: '100%' }}
        data={items}
        item={({
          data,
          index,
        }: {
          data: (typeof items)[number]
          index: number
        }) => (
          <div
            data-index={index}
            className={'item ' + (index % 2 === 0 ? 'even' : '')}
            style={{
              minHeight: scenario.dynamic ? undefined : scenario.itemSize,
            }}
          >
            {data.text}
          </div>
        )}
        onScroll={() => {
          // VList doesn't expose visible range directly; mark progress.
          measuredSet.current.add(measuredSet.current.size)
        }}
      />
    </div>
  )
}

export function VirtuaPageRoot({ scenario }: Props) {
  markMountStart()
  return <VirtuaPage scenario={scenario} />
}
