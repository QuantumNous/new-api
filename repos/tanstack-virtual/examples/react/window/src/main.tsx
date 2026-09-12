import * as React from 'react'
import * as ReactDOM from 'react-dom/client'

import './index.css'

import { useWindowVirtualizer } from '@tanstack/react-virtual'

function Example() {
  const listRef = React.useRef<HTMLDivElement | null>(null)
  const listOffsetRef = React.useRef(0)

  React.useLayoutEffect(() => {
    listOffsetRef.current = listRef.current?.offsetTop ?? 0
  }, [])

  const virtualizer = useWindowVirtualizer({
    count: 10000,
    estimateSize: () => 35,
    overscan: 5,
    scrollMargin: listOffsetRef.current,
  })

  return (
    <>
      <div ref={listRef} className="List">
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((item) => (
            <div
              key={item.key}
              className={item.index % 2 ? 'ListItemOdd' : 'ListItemEven'}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${item.size}px`,
                transform: `translateY(${
                  item.start - virtualizer.options.scrollMargin
                }px)`,
              }}
            >
              Row {item.index}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

function App() {
  return (
    <div>
      <p>
        In many cases, when implementing a virtualizer with a window as the
        scrolling element, developers often find the need to specify a
        "scrollMargin." The scroll margin is a crucial setting that defines the
        space or gap between the start of the page and the edges of the list.
      </p>
      <br />
      <br />
      <h3>Window scroller</h3>
      <Example />
      <br />
      <br />
      {process.env.NODE_ENV === 'development' ? (
        <p>
          <strong>Notice:</strong> You are currently running React in
          development mode. Rendering performance will be slightly degraded
          until this application is built for production.
        </p>
      ) : null}
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
