import * as React from 'react'
import * as ReactDOM from 'react-dom/client'

import './index.css'

import { useVirtualizer } from '@tanstack/react-virtual'

function App() {
  return (
    <div>
      <p>
        These components are using <strong>fixed</strong> sizes. This means that
        every element's dimensions are hard-coded to the same value and never
        change.
      </p>
      <br />
      <br />

      <h3>Rows</h3>
      <RowVirtualizerFixed />
      <br />
      <br />
      <h3>Columns</h3>
      <ColumnVirtualizerFixed />
      <br />
      <br />
      <h3>Grid</h3>
      <GridVirtualizerFixed />
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

function RowVirtualizerFixed() {
  const parentRef = React.useRef(null)

  const rowVirtualizer = useVirtualizer({
    count: 10000,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 35,
    overscan: 5,
  })

  return (
    <>
      <div
        ref={parentRef}
        className="List"
        style={{
          height: `200px`,
          width: `400px`,
          overflow: 'auto',
        }}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => (
            <div
              key={virtualRow.index}
              className={virtualRow.index % 2 ? 'ListItemOdd' : 'ListItemEven'}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              Row {virtualRow.index}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

function ColumnVirtualizerFixed() {
  const parentRef = React.useRef(null)

  const columnVirtualizer = useVirtualizer({
    horizontal: true,
    count: 10000,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100,
    overscan: 5,
  })

  return (
    <>
      <div
        ref={parentRef}
        className="List"
        style={{
          width: `400px`,
          height: `100px`,
          overflow: 'auto',
        }}
      >
        <div
          style={{
            width: `${columnVirtualizer.getTotalSize()}px`,
            height: '100%',
            position: 'relative',
          }}
        >
          {columnVirtualizer.getVirtualItems().map((virtualColumn) => (
            <div
              key={virtualColumn.index}
              className={
                virtualColumn.index % 2 ? 'ListItemOdd' : 'ListItemEven'
              }
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                height: '100%',
                width: `${virtualColumn.size}px`,
                transform: `translateX(${virtualColumn.start}px)`,
              }}
            >
              Column {virtualColumn.index}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

function GridVirtualizerFixed() {
  const parentRef = React.useRef(null)

  const rowVirtualizer = useVirtualizer({
    count: 10000,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 35,
    overscan: 5,
  })

  const columnVirtualizer = useVirtualizer({
    horizontal: true,
    count: 10000,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100,
    overscan: 5,
  })

  return (
    <>
      <div
        ref={parentRef}
        className="List"
        style={{
          height: `500px`,
          width: `500px`,
          overflow: 'auto',
        }}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: `${columnVirtualizer.getTotalSize()}px`,
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => (
            <React.Fragment key={virtualRow.key}>
              {columnVirtualizer.getVirtualItems().map((virtualColumn) => (
                <div
                  key={virtualColumn.key}
                  className={
                    virtualColumn.index % 2
                      ? virtualRow.index % 2 === 0
                        ? 'ListItemOdd'
                        : 'ListItemEven'
                      : virtualRow.index % 2
                        ? 'ListItemOdd'
                        : 'ListItemEven'
                  }
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: `${virtualColumn.size}px`,
                    height: `${virtualRow.size}px`,
                    transform: `translateX(${virtualColumn.start}px) translateY(${virtualRow.start}px)`,
                  }}
                >
                  Cell {virtualRow.index}, {virtualColumn.index}
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>
    </>
  )
}

// eslint-disable-next-line
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
