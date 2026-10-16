import React from 'react'
import ReactDOM from 'react-dom/client'
import { useVirtualizer } from '@tanstack/react-virtual'

function getRandomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

const randomHeight = (() => {
  const cache = new Map()
  return (id: string) => {
    const value = cache.get(id)
    if (value !== undefined) {
      return value
    }
    const v = getRandomInt(25, 100)
    cache.set(id, v)
    return v
  }
})()

const App = () => {
  const parentRef = React.useRef<HTMLDivElement>(null)
  const initialOffset = Number(
    new URLSearchParams(window.location.search).get('initialOffset') ?? 0,
  )
  const rowVirtualizer = useVirtualizer({
    count: 1002,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50,
    initialOffset,
    debug: true,
  })

  return (
    <div>
      <button
        id="scroll-to-1000"
        onClick={() => rowVirtualizer.scrollToIndex(1000)}
      >
        Scroll to 1000
      </button>
      <button
        id="scroll-to-last"
        onClick={() => rowVirtualizer.scrollToIndex(1001)}
      >
        Scroll to last
      </button>
      <button id="scroll-to-0" onClick={() => rowVirtualizer.scrollToIndex(0)}>
        Scroll to 0
      </button>

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
          {rowVirtualizer.getVirtualItems().map((v) => (
            <div
              key={v.key}
              data-testid={`item-${v.index}`}
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
              <div style={{ height: randomHeight(String(v.key)) }}>
                Row {v.index}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(<App />)
