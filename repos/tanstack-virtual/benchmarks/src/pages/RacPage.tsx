import { useEffect, useMemo, useRef } from 'react'
import {
  ListBox,
  ListBoxItem,
  ListLayout,
  Virtualizer,
} from 'react-aria-components'
import {
  markFirstPaint,
  markMountEnd,
  markMountStart,
  registerHarness,
} from '../lib/harness'
import { ItemRow } from '../lib/itemRow'
import { cacheRacScroller, createRacVirtualHarness } from '../lib/racBench'
import { makeDataset } from '../lib/dataset'
import type { ListLayoutOptions } from 'react-aria-components'
import type { ScenarioInput } from '../scenarios/types'

interface Props {
  scenario: ScenarioInput
}

export function RacPage({ scenario }: Props) {
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
  const scrollerRef = useRef<HTMLElement | null>(null)
  const layoutRef = useRef<ListLayout<unknown>>(null)

  const layoutOptions = useMemo<ListLayoutOptions>(() => {
    if (scenario.dynamic) {
      return {
        rowSize: scenario.itemSize,
        estimatedRowSize: scenario.itemSize,
      }
    }
    return { rowSize: scenario.itemSize }
  }, [scenario.dynamic, scenario.itemSize])

  const layout = useMemo(() => {
    const l = new ListLayout<unknown>(layoutOptions)
    layoutRef.current = l
    return l
  }, [layoutOptions])

  useEffect(() => {
    cacheRacScroller(hostRef.current, scrollerRef)
    registerHarness(
      createRacVirtualHarness({
        hostRef,
        scrollerRef,
        layoutRef,
        items,
        scenario,
      }),
    )
    markMountEnd()
    markFirstPaint()
  }, [items, scenario])

  return (
    <div
      ref={hostRef}
      className="scroll-host"
      data-bench-scroll-host="rac"
      style={{ height: 600, width: 600 }}
    >
      <Virtualizer layout={layout}>
        <ListBox
          items={items}
          aria-label="benchmark list"
          style={{
            height: '100%',
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
      </Virtualizer>
    </div>
  )
}

export function RacPageRoot({ scenario }: Props) {
  markMountStart()
  return <RacPage scenario={scenario} />
}
