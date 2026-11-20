import { useEffect, useMemo, useRef } from 'react'
import {
  List,
  useDynamicRowHeight,
  useListRef,
  type RowComponentProps,
} from 'react-window'
import {
  markFirstPaint,
  markMountEnd,
  markMountStart,
  registerHarness,
} from '../lib/harness'
import { makeDataset, type Item } from '../lib/dataset'
import type { ScenarioInput } from '../scenarios/types'

interface Props {
  scenario: ScenarioInput
}

function Row({
  index,
  style,
  items,
  ariaAttributes,
}: RowComponentProps<{ items: Item[] }>) {
  const item = items[index]!
  return (
    <div
      data-index={index}
      className={'item ' + (index % 2 === 0 ? 'even' : '')}
      style={style}
      {...ariaAttributes}
    >
      {item.text}
    </div>
  )
}

export function WindowPage({ scenario }: Props) {
  const items = useMemo(
    () =>
      makeDataset(
        scenario.count,
        scenario.dynamic,
        scenario.action === 'jump-wide-variance-accuracy',
      ),
    [scenario.count, scenario.dynamic, scenario.action],
  )

  const hostRef = useRef<HTMLDivElement>(null)
  const listRef = useListRef()
  const dynamic = useDynamicRowHeight({ defaultRowHeight: scenario.itemSize })

  useEffect(() => {
    registerHarness({
      getScrollContainer: () => {
        // react-window v2 mounts the scrolling element as the first child.
        return (
          (hostRef.current?.firstElementChild as HTMLElement | null) ??
          hostRef.current
        )
      },
      scrollToIndex: (i, opts) =>
        listRef.current?.scrollToRow({
          index: i,
          align: opts?.align ?? 'start',
          behavior: 'instant',
        }),
      getTotalSize: () => {
        const el = hostRef.current?.firstElementChild as HTMLElement | null
        return el?.scrollHeight ?? 0
      },
      isFullyMeasured: () => {
        if (!scenario.dynamic) return true
        const avg = dynamic.getAverageRowHeight()
        return avg > 0
      },
    })
    markMountEnd()
    markFirstPaint()
  }, [listRef, dynamic, scenario.dynamic])

  return (
    <div ref={hostRef} className="scroll-host" data-bench-scroll-host="window">
      <List<{ items: Item[] }>
        listRef={listRef}
        rowComponent={Row}
        rowCount={items.length}
        rowProps={{ items }}
        rowHeight={scenario.dynamic ? dynamic : scenario.itemSize}
        defaultHeight={600}
        style={{ height: '100%', width: '100%' }}
        overscanCount={5}
      />
    </div>
  )
}

export function WindowPageRoot({ scenario }: Props) {
  markMountStart()
  return <WindowPage scenario={scenario} />
}
