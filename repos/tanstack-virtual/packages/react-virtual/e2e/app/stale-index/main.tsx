import React from 'react'
import ReactDOM from 'react-dom/client'
import { useVirtualizer } from '@tanstack/react-virtual'

/**
 * Regression test app for stale index bug:
 * When items are removed from the end of the list, the ResizeObserver may fire
 * for a disconnected node whose data-index >= the new count. If getItemKey
 * indexes into the items array, this causes an out-of-bounds error.
 */

interface Item {
  id: string
  label: string
}

function makeItems(count: number): Array<Item> {
  return Array.from({ length: count }, (_, i) => ({
    id: `item-${i}`,
    label: `Row ${i}`,
  }))
}

const App = () => {
  const parentRef = React.useRef<HTMLDivElement>(null)
  const [items, setItems] = React.useState(() => makeItems(20))
  const [error, setError] = React.useState<string | null>(null)

  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50,
    getItemKey: (index) => {
      if (index < 0 || index >= items.length) {
        const msg = `getItemKey called with stale index ${index} (count=${items.length})`
        setError(msg)
        throw new Error(msg)
      }
      return items[index].id
    },
  })

  const removeLastFive = () => {
    setItems((prev) => prev.slice(0, Math.max(0, prev.length - 5)))
  }

  return (
    <div>
      <button data-testid="remove-items" onClick={removeLastFive}>
        Remove last 5
      </button>
      <div data-testid="item-count">Count: {items.length}</div>
      {error && <div data-testid="error">{error}</div>}
      <div
        ref={parentRef}
        data-testid="scroll-container"
        style={{ height: 300, overflow: 'auto' }}
      >
        <div
          style={{
            height: rowVirtualizer.getTotalSize(),
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((v) => {
            const item = items[v.index]
            return (
              <div
                key={item.id}
                data-testid={item.id}
                ref={rowVirtualizer.measureElement}
                data-index={v.index}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  transform: `translateY(${v.start}px)`,
                  width: '100%',
                  height: 50,
                  borderBottom: '1px solid #ccc',
                  padding: 8,
                  boxSizing: 'border-box',
                }}
              >
                {item.label}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
