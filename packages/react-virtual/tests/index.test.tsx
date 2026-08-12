import { beforeEach, test, expect, vi } from 'vitest'
import * as React from 'react'
import { render, screen } from '@testing-library/react'

import { useVirtualizer, Range } from '../src/index'

beforeEach(() => {
  Object.defineProperties(HTMLElement.prototype, {
    scrollHeight: {
      configurable: true,
      get: () => Number.MAX_SAFE_INTEGER,
    },
    scrollWidth: {
      configurable: true,
      get: () => Number.MAX_SAFE_INTEGER,
    },
  })
})

let renderer: vi.Mock<undefined, []>

interface ListProps {
  count?: number
  overscan?: number
  height?: number
  width?: number
  itemSize?: number
  rangeExtractor?: (range: Range) => number[]
  dynamic?: boolean
}

function List({
  count = 200,
  overscan,
  height = 200,
  width = 200,
  itemSize,
  rangeExtractor,
  dynamic,
}: ListProps) {
  renderer()

  const parentRef = React.useRef<HTMLDivElement>(null)

  const elementRectCallbackRef = React.useRef<
    ((rect: { height: number; width: number }) => void) | null
  >(null)

  const rowVirtualizer = useVirtualizer({
    count,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50,
    overscan,
    observeElementRect: (_, cb) => {
      cb({ height, width })
      elementRectCallbackRef.current = cb
    },
    measureElement: () => itemSize ?? 0,
    rangeExtractor,
  })

  React.useEffect(() => {
    elementRectCallbackRef.current?.({ height, width })
  }, [height, width])

  const measureElement = dynamic ? rowVirtualizer.measureElement : undefined

  const items = rowVirtualizer.getVirtualItems()

  return (
    <div
      ref={parentRef}
      style={{ height, width, overflow: 'auto' }}
      data-testid="scroller"
    >
      <div
        style={{
          height: rowVirtualizer.getTotalSize(),
          width: '100%',
          position: 'relative',
        }}
      >
        {items.map((virtualRow) => (
          <div
            data-testid={`item-${virtualRow.key}`}
            key={virtualRow.key}
            data-index={virtualRow.index}
            ref={measureElement}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualRow.start}px)`,
              height: itemSize,
            }}
          >
            Row {virtualRow.index}
          </div>
        ))}
      </div>
    </div>
  )
}

beforeEach(() => {
  renderer = vi.fn(() => undefined)
})

test('should render', () => {
  render(<List />)

  expect(screen.queryByText('Row 0')).toBeInTheDocument()
  expect(screen.queryByText('Row 4')).toBeInTheDocument()
  expect(screen.queryByText('Row 5')).not.toBeInTheDocument()

  expect(renderer).toHaveBeenCalledTimes(2)
})

test('should render with overscan', () => {
  render(<List overscan={0} />)

  expect(screen.queryByText('Row 0')).toBeInTheDocument()
  expect(screen.queryByText('Row 3')).toBeInTheDocument()
  expect(screen.queryByText('Row 4')).not.toBeInTheDocument()

  expect(renderer).toHaveBeenCalledTimes(2)
})

test('should render given dynamic size', async () => {
  render(<List itemSize={100} dynamic />)

  expect(screen.queryByText('Row 0')).toBeInTheDocument()
  expect(screen.queryByText('Row 1')).toBeInTheDocument()
  expect(screen.queryByText('Row 2')).toBeInTheDocument()
  expect(screen.queryByText('Row 3')).not.toBeInTheDocument()

  expect(renderer).toHaveBeenCalledTimes(3)
})

test('should use rangeExtractor', () => {
  render(<List rangeExtractor={() => [0, 1]} />)

  expect(screen.queryByText('Row 0')).toBeInTheDocument()
  expect(screen.queryByText('Row 1')).toBeInTheDocument()
  expect(screen.queryByText('Row 2')).not.toBeInTheDocument()
})

test('should handle count change', () => {
  const { rerender } = render(<List count={2} />)

  expect(screen.queryByText('Row 0')).toBeInTheDocument()
  expect(screen.queryByText('Row 1')).toBeInTheDocument()
  expect(screen.queryByText('Row 2')).not.toBeInTheDocument()

  rerender(<List count={10} />)

  expect(screen.queryByText('Row 2')).toBeInTheDocument()
  expect(screen.queryByText('Row 4')).toBeInTheDocument()
  expect(screen.queryByText('Row 5')).not.toBeInTheDocument()
})

test('should handle handle height change', () => {
  const { rerender } = render(<List count={0} height={0} />)

  expect(screen.queryByText('Row 0')).not.toBeInTheDocument()
  rerender(<List count={1} height={200} />)
  expect(screen.queryByText('Row 0')).toBeInTheDocument()
})
