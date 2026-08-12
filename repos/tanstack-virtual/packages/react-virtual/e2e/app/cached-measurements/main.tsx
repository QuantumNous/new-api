import React from 'react'
import ReactDOM from 'react-dom/client'
import { useVirtualizer } from '@tanstack/react-virtual'

const items = Array.from({ length: 20 }, (_, i) => ({
  id: `item-${i}`,
  label: `Item ${i}`,
  height: 30 + (i % 3) * 20, // variable heights: 30, 50, 70
}))

const App = () => {
  const parentRef = React.useRef<HTMLDivElement>(null)
  const [hidden, setHidden] = React.useState(false)

  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => items[i].height,
    getItemKey: (i) => items[i].id,
    useCachedMeasurements: hidden,
    directDomUpdates: true,
  })

  return (
    <div>
      <button data-testid="toggle" onClick={() => setHidden((h) => !h)}>
        {hidden ? 'Show' : 'Hide'}
      </button>
      <div
        data-testid="list-wrapper"
        style={{ display: hidden ? 'none' : 'block' }}
      >
        <div
          ref={parentRef}
          id="scroll-container"
          style={{ height: 200, overflow: 'auto' }}
        >
          <div
            ref={rowVirtualizer.containerRef}
            style={{ position: 'relative', width: '100%' }}
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
                    width: '100%',
                    height: item.height,
                  }}
                >
                  {item.label}
                </div>
              )
            })}
          </div>
        </div>
      </div>
      <div data-testid="total-size">{rowVirtualizer.getTotalSize()}</div>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
