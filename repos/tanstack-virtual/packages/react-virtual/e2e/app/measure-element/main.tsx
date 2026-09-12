import React from 'react'
import ReactDOM from 'react-dom/client'
import { useVirtualizer } from '@tanstack/react-virtual'

interface Item {
  id: string
  label: string
}

const INITIAL_ITEMS: Array<Item> = [
  { id: 'item-a', label: 'A' },
  { id: 'item-b', label: 'B' },
  { id: 'item-c', label: 'C' },
]

const App = () => {
  const parentRef = React.useRef<HTMLDivElement>(null)
  const [items, setItems] = React.useState(INITIAL_ITEMS)
  const [expandedId, setExpandedId] = React.useState<string | null>(null)

  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
    getItemKey: (index) => items[index].id,
  })

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  const deleteItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
    if (expandedId === id) {
      setExpandedId(null)
    }
  }

  return (
    <div>
      <div
        ref={parentRef}
        id="scroll-container"
        style={{ height: 400, overflow: 'auto' }}
      >
        <div
          style={{
            height: rowVirtualizer.getTotalSize(),
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((v) => {
            const item = items[v.index]
            const isExpanded = expandedId === item.id

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
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                    padding: 4,
                  }}
                >
                  <span>Row {item.label}</span>
                  <button
                    data-testid={`expand-${item.id}`}
                    onClick={() => toggleExpand(item.id)}
                  >
                    {isExpanded ? 'Collapse' : 'Expand'}
                  </button>
                  <button
                    data-testid={`delete-${item.id}`}
                    onClick={() => deleteItem(item.id)}
                  >
                    Delete
                  </button>
                </div>
                {isExpanded && (
                  <div
                    data-testid={`content-${item.id}`}
                    style={{
                      height: 124,
                      background: '#eee',
                      padding: 8,
                    }}
                  >
                    Expanded content for {item.label}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
      <div data-testid="total-size">{rowVirtualizer.getTotalSize()}</div>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
