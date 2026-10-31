import './index.css'
import * as React from 'react'
import ReactDOM from 'react-dom'
import { faker } from '@faker-js/faker'
import { findIndex, groupBy } from 'lodash'
import { defaultRangeExtractor, useVirtualizer } from '@tanstack/react-virtual'
import type { Range } from '@tanstack/react-virtual'

const groupedNames = groupBy(
  Array.from({ length: 1000 })
    .map(() => faker.person.firstName())
    .sort(),
  (name) => name[0],
)
const groups = Object.keys(groupedNames)
const rows = groups.reduce<Array<string>>(
  (acc, k) => [...acc, k, ...groupedNames[k]],
  [],
)

const App = () => {
  const parentRef = React.useRef<HTMLDivElement>(null)

  const activeStickyIndexRef = React.useRef(0)

  const stickyIndexes = React.useMemo(
    () => groups.map((gn) => findIndex(rows, (n) => n === gn)),
    [],
  )

  const isSticky = (index: number) => stickyIndexes.includes(index)

  const isActiveSticky = (index: number) =>
    activeStickyIndexRef.current === index

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    estimateSize: () => 50,
    getScrollElement: () => parentRef.current,
    rangeExtractor: React.useCallback(
      (range: Range) => {
        activeStickyIndexRef.current =
          [...stickyIndexes]
            .reverse()
            .find((index) => range.startIndex >= index) ?? 0

        const next = new Set([
          activeStickyIndexRef.current,
          ...defaultRangeExtractor(range),
        ])

        return [...next].sort((a, b) => a - b)
      },
      [stickyIndexes],
    ),
  })

  return (
    <div>
      <div
        ref={parentRef}
        className="List"
        style={{
          height: `300px`,
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
              className={'ListItem'}
              style={{
                ...(isSticky(virtualRow.index)
                  ? {
                      background: '#fff',
                      borderBottom: '1px solid #ddd',
                      zIndex: 1,
                    }
                  : {}),
                ...(isActiveSticky(virtualRow.index)
                  ? {
                      position: 'sticky',
                    }
                  : {
                      position: 'absolute',
                      transform: `translateY(${virtualRow.start}px)`,
                    }),
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
              }}
            >
              {rows[virtualRow.index]}
            </div>
          ))}
        </div>
      </div>
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

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root'),
)
