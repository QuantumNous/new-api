import * as React from 'react'
import { createRoot } from 'react-dom/client'
import { faker } from '@faker-js/faker'

import { useVirtualizer, useWindowVirtualizer } from '@tanstack/react-virtual'

import './index.css'

const randomNumber = (min: number, max: number) =>
  faker.number.int({ min, max })

const sentences = new Array(10000)
  .fill(true)
  .map(() => faker.lorem.sentence(randomNumber(20, 70)))

function RowVirtualizerDynamic() {
  const parentRef = React.useRef<HTMLDivElement>(null)

  const [enabled, setEnabled] = React.useState(true)

  const count = sentences.length
  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 45,
    enabled,
    directDomUpdates: true,
  })

  React.useEffect(() => {
    virtualizer.scrollToIndex(count - 1, { align: 'end' })
  }, [])

  return (
    <div>
      <button
        onClick={() => {
          virtualizer.scrollToIndex(0)
        }}
      >
        scroll to the top
      </button>
      <span style={{ padding: '0 4px' }} />
      <button
        onClick={() => {
          virtualizer.scrollToIndex(count / 2, { behavior: 'smooth' })
        }}
      >
        scroll to the middle
      </button>
      <span style={{ padding: '0 4px' }} />
      <button
        onClick={() => {
          virtualizer.scrollToIndex(count - 1)
        }}
      >
        scroll to the end
      </button>
      <span style={{ padding: '0 4px' }} />
      <button
        onClick={() => {
          setEnabled((prev) => !prev)
        }}
      >
        turn {enabled ? 'off' : 'on'} virtualizer
      </button>
      <hr />
      <div
        ref={parentRef}
        className="List"
        style={{
          height: 400,
          width: 400,
          overflowY: 'auto',
          contain: 'strict',
          overflowAnchor: 'none',
        }}
      >
        <div
          ref={virtualizer.containerRef}
          style={{
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((v) => (
            <div
              key={v.key}
              data-testid={`item-${v.index}`}
              ref={virtualizer.measureElement}
              className={v.index % 2 ? 'ListItemOdd' : 'ListItemEven'}
              data-index={v.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
              }}
            >
              <div style={{ padding: '10px 0' }}>
                <div>Row {v.index}</div>
                <div>{sentences[v.index]}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ColumnVirtualizerDynamic() {
  const parentRef = React.useRef<HTMLDivElement | null>(null)

  const virtualizer = useVirtualizer({
    horizontal: true,
    count: sentences.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 45,
  })

  return (
    <>
      <div
        ref={parentRef}
        className="List"
        style={{ width: 400, height: 400, overflowY: 'auto' }}
      >
        <div
          style={{
            width: virtualizer.getTotalSize(),
            height: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualColumn) => (
            <div
              key={virtualColumn.key}
              data-index={virtualColumn.index}
              ref={virtualizer.measureElement}
              className={
                virtualColumn.index % 2 ? 'ListItemOdd' : 'ListItemEven'
              }
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                height: '100%',
                transform: `translateX(${virtualColumn.start}px)`,
              }}
            >
              <div style={{ width: sentences[virtualColumn.index].length }}>
                <div>Column {virtualColumn.index}</div>
                <div>{sentences[virtualColumn.index]}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

interface Column {
  key: string
  name: string
  width: number
}

function GridVirtualizerDynamic({
  columns,
  data,
}: {
  data: Array<Array<string>>
  columns: Array<Column>
}) {
  const parentRef = React.useRef<HTMLDivElement | null>(null)

  const parentOffsetRef = React.useRef(0)

  React.useLayoutEffect(() => {
    parentOffsetRef.current = parentRef.current?.offsetTop ?? 0
  }, [])

  const getColumnWidth = (index: number) => columns[index].width

  const virtualizer = useWindowVirtualizer({
    count: data.length,
    estimateSize: () => 350,
    overscan: 5,
    scrollMargin: parentOffsetRef.current,
  })

  const columnVirtualizer = useVirtualizer({
    horizontal: true,
    count: columns.length,
    getScrollElement: () => parentRef.current,
    estimateSize: getColumnWidth,
    overscan: 5,
  })
  const columnItems = columnVirtualizer.getVirtualItems()
  const [before, after] =
    columnItems.length > 0
      ? [
          columnItems[0].start,
          columnVirtualizer.getTotalSize() -
            columnItems[columnItems.length - 1].end,
        ]
      : [0, 0]

  return (
    <div
      ref={parentRef}
      style={{ overflowY: 'auto', border: '1px solid #c8c8c8' }}
    >
      <div
        style={{
          height: virtualizer.getTotalSize(),
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((row) => {
          return (
            <div
              key={row.key}
              data-index={row.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                transform: `translateY(${
                  row.start - virtualizer.options.scrollMargin
                }px)`,
                display: 'flex',
              }}
            >
              <div style={{ width: `${before}px` }} />
              {columnItems.map((column) => {
                return (
                  <div
                    key={column.key}
                    style={{
                      minHeight: row.index === 0 ? 50 : row.size,
                      width: getColumnWidth(column.index),
                      borderBottom: '1px solid #c8c8c8',
                      borderRight: '1px solid #c8c8c8',
                      padding: '7px 12px',
                    }}
                  >
                    {row.index === 0 ? (
                      <div>{columns[column.index].name}</div>
                    ) : (
                      <div>{data[row.index][column.index]}</div>
                    )}
                  </div>
                )
              })}
              <div style={{ width: `${after}px` }} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

const generateColumns = (count: number) => {
  return new Array(count).fill(0).map((_, i) => {
    const key: string = i.toString()
    return {
      key,
      name: `Column ${i}`,
      width: randomNumber(75, 300),
    }
  })
}

const generateData = (columns: Array<Column>, count = 300) => {
  return new Array(count).fill(0).map((_, rowIndex) =>
    columns.reduce<Array<string>>((acc, _curr, colIndex) => {
      // simulate dynamic size cells
      const val = faker.lorem.lines(((rowIndex + colIndex) % 10) + 1)

      acc.push(val)

      return acc
    }, []),
  )
}

function RowVirtualizerExperimental() {
  const parentRef = React.useRef<HTMLDivElement>(null)
  const innerRef = React.useRef<HTMLDivElement>(null)
  const rowRefsMap = React.useRef(new Map<number, HTMLDivElement>())

  const [enabled, setEnabled] = React.useState(true)

  const count = sentences.length
  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 45,
    enabled,
    onChange: (instance) => {
      innerRef.current!.style.height = `${instance.getTotalSize()}px`
      instance.getVirtualItems().forEach((virtualRow) => {
        const rowRef = rowRefsMap.current.get(virtualRow.index)
        if (!rowRef) return
        rowRef.style.transform = `translateY(${virtualRow.start}px)`
      })
    },
  })

  const indexes = virtualizer.getVirtualIndexes()

  React.useEffect(() => {
    virtualizer.measure()
  }, [])

  return (
    <div>
      <button
        onClick={() => {
          virtualizer.scrollToIndex(0)
        }}
      >
        scroll to the top
      </button>
      <span style={{ padding: '0 4px' }} />
      <button
        onClick={() => {
          virtualizer.scrollToIndex(count / 2)
        }}
      >
        scroll to the middle
      </button>
      <span style={{ padding: '0 4px' }} />
      <button
        onClick={() => {
          virtualizer.scrollToIndex(count - 1)
        }}
      >
        scroll to the end
      </button>
      <span style={{ padding: '0 4px' }} />
      <button
        onClick={() => {
          setEnabled((prev) => !prev)
        }}
      >
        turn {enabled ? 'off' : 'on'} virtualizer
      </button>
      <hr />
      <div
        ref={parentRef}
        className="List"
        style={{
          height: 400,
          width: 400,
          overflowY: 'auto',
          contain: 'strict',
        }}
      >
        <div
          ref={innerRef}
          style={{
            width: '100%',
            position: 'relative',
          }}
        >
          {indexes.map((index) => (
            <div
              key={index}
              data-index={index}
              ref={(el) => {
                if (el) {
                  virtualizer.measureElement(el)
                  rowRefsMap.current.set(index, el)
                }
              }}
              className={index % 2 ? 'ListItemOdd' : 'ListItemEven'}
            >
              <div style={{ padding: '10px 0' }}>
                <div>Row {index}</div>
                <div>{sentences[index]}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function App() {
  const pathname = location.pathname
  return (
    <div>
      <p>
        These components are using <strong>dynamic</strong> sizes. This means
        that each element's exact dimensions are unknown when rendered. An
        estimated dimension is used as the initial measurement, then this
        measurement is readjusted on the fly as each element is rendered.
      </p>
      <nav>
        <ul>
          <li>
            <a href="/">List</a>
          </li>
          <li>
            <a href="/columns">Column</a>
          </li>
          <li>
            <a href="/grid">Grid</a>
          </li>
          <li>
            <a href="/experimental">Experimental</a>
          </li>
        </ul>
      </nav>
      {(() => {
        switch (pathname) {
          case '/':
            return <RowVirtualizerDynamic />
          case '/columns':
            return <ColumnVirtualizerDynamic />
          case '/grid': {
            const columns = generateColumns(30)
            const data = generateData(columns)
            return <GridVirtualizerDynamic columns={columns} data={data} />
          }
          case '/experimental':
            return <RowVirtualizerExperimental />
          default:
            return <div>Not found</div>
        }
      })()}
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

const container = document.getElementById('root')!
const root = createRoot(container)
const { StrictMode } = React

root.render(
  <StrictMode>
    <App />
  </StrictMode>,
)
