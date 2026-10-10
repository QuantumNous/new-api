import { useEffect, useMemo, useRef } from 'react'
import { ListBox, ListBoxItem } from 'react-aria-components'
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

export function RacListboxPage({ scenario }: Props) {
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

  useEffect(() => {
    registerHarness({
      getScrollContainer: () => hostRef.current,
      getSearchRoot: () => hostRef.current,
      scrollToIndex: (index, opts) => {
        const host = hostRef.current
        if (!host) return
        const align = opts?.align ?? 'start'
        const itemEl = host.querySelector(`[data-index="${index}"]`)
        if (itemEl instanceof HTMLElement) {
          itemEl.scrollIntoView({
            block: align === 'end' ? 'end' : 'start',
            inline: 'nearest',
          })
          return
        }
        const top =
          align === 'end'
            ? index * scenario.itemSize + scenario.itemSize - host.clientHeight
            : index * scenario.itemSize
        const max = Math.max(0, host.scrollHeight - host.clientHeight)
        host.scrollTop = Math.max(0, Math.min(top, max))
      },
      getTotalSize: () => hostRef.current?.scrollHeight ?? 0,
      // Non-virtualized list: all rows are in the DOM once mounted.
      isFullyMeasured: () => hostRef.current !== null,
    })
    markMountEnd()
    markFirstPaint()
  }, [scenario])

  return (
    <div
      ref={hostRef}
      className="scroll-host"
      data-bench-scroll-host="rac-listbox"
      style={{ height: 600, width: 600, overflow: 'auto' }}
    >
      <ListBox
        items={items}
        aria-label="benchmark list"
        style={{
          width: '100%',
          margin: 0,
          padding: 0,
          boxSizing: 'border-box',
        }}
      >
        {(item) => (
          <ListBoxItem
            id={item.id}
            textValue={item.text}
            style={{
              minHeight: scenario.dynamic ? undefined : scenario.itemSize,
              boxSizing: 'border-box',
            }}
          >
            <ItemRow
              item={item}
              index={item.id}
              itemSize={scenario.itemSize}
              dynamic={scenario.dynamic}
            />
          </ListBoxItem>
        )}
      </ListBox>
    </div>
  )
}

export function RacListboxPageRoot({ scenario }: Props) {
  markMountStart()
  return <RacListboxPage scenario={scenario} />
}
