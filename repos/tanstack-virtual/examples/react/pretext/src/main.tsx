import React from 'react'
import { createRoot } from 'react-dom/client'
import { clearCache, layout, prepare } from '@chenglou/pretext'
import { useVirtualizer } from '@tanstack/react-virtual'

import './index.css'

type Message = {
  id: string
  author: string
  body: string
  time: string
  type: 'agent' | 'user'
}

const BODY_FONT = '14px Arial'
const BODY_LINE_HEIGHT = 20
const BODY_LETTER_SPACING = 0
const BUBBLE_BORDER_WIDTH = 2
const BUBBLE_MAX_WIDTH = 680
const BUBBLE_X_PADDING = 28
const BUBBLE_Y_PADDING = 24
const META_BODY_GAP = 6
const META_HEIGHT = 18
const ROW_X_PADDING = 32
const ROW_Y_PADDING = 16
const DEFAULT_VIEWPORT_WIDTH = 760

const preparedCache = new Map<string, ReturnType<typeof prepare>>()

const sampleBodies = [
  'The expensive part of variable-height virtualization is usually discovering the height after the row has already rendered. Pretext lets this example calculate the message height from the text, font, width, and line-height before the DOM node exists.',
  'This row includes hard breaks.\n\nThe CSS uses white-space: pre-wrap, so the Pretext prepare call uses the same option. Keeping those two in sync is the difference between a stable scroll position and a slow drip of measurement corrections.',
  'Resize the page and the example reruns layout() for the new content width. It does not rerun prepare() unless the text or font inputs change.',
  'Rows still use TanStack Virtual for scroll state, range extraction, absolute positioning, overscan, and scrollToIndex. Pretext only owns text measurement.',
  'If a row contains media, embeds, block markdown, or custom components, let the virtualizer measure that row with measureElement or call resizeItem when the non-text content resolves.',
  'The practical pattern is to make one part of the system responsible for each row size. For these text-only rows, Pretext provides the size. For mixed content, measured DOM can be the fallback.',
  'A named font is intentional here. Pretext uses canvas text measurement, and named fonts are easier to keep aligned with CSS than system font aliases.',
  'The virtualizer is reset after fonts finish loading. That clears Pretext caches and recalculates row sizes using the final font metrics.',
  'Pretext returns zero height for an empty string. If your UI still renders an empty text block as one line, clamp the measured body height to at least one line-height.',
  'This is a synthetic chat log, but the same approach works for AI streams, activity feeds, notification centers, changelogs, comment threads, and other text-heavy timelines.',
]

const messages = Array.from({ length: 2000 }, (_, index): Message => {
  const body = sampleBodies[index % sampleBodies.length]!
  const repeatCount = index % 7 === 0 ? 2 : 1
  const repeatedBody = Array.from({ length: repeatCount }, () => body).join(
    '\n\n',
  )

  return {
    id: `message-${index}`,
    author: index % 3 === 0 ? 'Support' : index % 3 === 1 ? 'Customer' : 'Ops',
    body: `${repeatedBody}\n\nMessage ${index + 1}`,
    time: `${String(8 + (index % 10)).padStart(2, '0')}:${String(
      (index * 7) % 60,
    ).padStart(2, '0')}`,
    type: index % 3 === 1 ? 'user' : 'agent',
  }
})

function fallbackTextHeight(text: string, width: number) {
  const averageCharacterWidth = 7
  const charactersPerLine = Math.max(
    1,
    Math.floor(width / averageCharacterWidth),
  )

  return text.split('\n').reduce((height, paragraph) => {
    const lineCount = Math.max(
      1,
      Math.ceil(paragraph.length / charactersPerLine),
    )
    return height + lineCount * BODY_LINE_HEIGHT
  }, 0)
}

function getPreparedMessage(message: Message) {
  const key = `${message.id}:${BODY_FONT}:${BODY_LETTER_SPACING}:${message.body}`
  const cached = preparedCache.get(key)

  if (cached) {
    return cached
  }

  const prepared = prepare(message.body, BODY_FONT, {
    letterSpacing: BODY_LETTER_SPACING,
    whiteSpace: 'pre-wrap',
  })
  preparedCache.set(key, prepared)
  return prepared
}

function estimateMessageHeight(message: Message, viewportWidth: number) {
  const bubbleWidth = Math.min(
    BUBBLE_MAX_WIDTH,
    Math.max(1, viewportWidth - ROW_X_PADDING),
  )
  const textWidth = Math.max(
    1,
    bubbleWidth - BUBBLE_X_PADDING - BUBBLE_BORDER_WIDTH,
  )
  const textHeight =
    typeof Intl !== 'undefined' && 'Segmenter' in Intl
      ? layout(getPreparedMessage(message), textWidth, BODY_LINE_HEIGHT).height
      : fallbackTextHeight(message.body, textWidth)
  const bodyHeight = Math.max(BODY_LINE_HEIGHT, textHeight)

  return Math.ceil(
    ROW_Y_PADDING +
      BUBBLE_Y_PADDING +
      BUBBLE_BORDER_WIDTH +
      META_HEIGHT +
      META_BODY_GAP +
      bodyHeight,
  )
}

function useElementWidth(ref: React.RefObject<HTMLElement | null>) {
  const [width, setWidth] = React.useState(DEFAULT_VIEWPORT_WIDTH)

  React.useLayoutEffect(() => {
    const element = ref.current

    if (!element) {
      return
    }

    const updateWidth = () => {
      setWidth(Math.max(1, Math.round(element.clientWidth)))
    }

    updateWidth()

    const observer = new ResizeObserver(updateWidth)
    observer.observe(element)

    return () => {
      observer.disconnect()
    }
  }, [ref])

  return width
}

function App() {
  const parentRef = React.useRef<HTMLDivElement>(null)
  const viewportWidth = useElementWidth(parentRef)
  const [fontVersion, setFontVersion] = React.useState(0)

  const rowVirtualizer = useVirtualizer({
    count: messages.length,
    estimateSize: React.useCallback(
      (index) => estimateMessageHeight(messages[index]!, viewportWidth),
      [fontVersion, viewportWidth],
    ),
    getItemKey: React.useCallback((index: number) => messages[index]!.id, []),
    getScrollElement: () => parentRef.current,
    overscan: 8,
  })

  React.useLayoutEffect(() => {
    rowVirtualizer.measure()
  }, [fontVersion, rowVirtualizer, viewportWidth])

  React.useEffect(() => {
    let cancelled = false

    document.fonts.ready.then(() => {
      if (cancelled) {
        return
      }

      preparedCache.clear()
      clearCache()
      setFontVersion((value) => value + 1)
    })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main className="app">
      <div className="toolbar">
        <button type="button" onClick={() => rowVirtualizer.scrollToIndex(0)}>
          Top
        </button>
        <button
          type="button"
          onClick={() => rowVirtualizer.scrollToIndex(messages.length / 2)}
        >
          Middle
        </button>
        <button
          type="button"
          onClick={() => rowVirtualizer.scrollToIndex(messages.length - 1)}
        >
          Bottom
        </button>
        <div className="stat">
          {rowVirtualizer.getVirtualItems().length} rendered of{' '}
          {messages.length}
        </div>
      </div>

      <div ref={parentRef} className="list">
        <div
          className="spacer"
          style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const message = messages[virtualRow.index]!

            return (
              <div
                className={`message-row ${message.type}`}
                key={virtualRow.key}
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <article className="message-bubble">
                  <div className="message-meta">
                    <span>{message.author}</span>
                    <span className="message-time">{message.time}</span>
                  </div>
                  <p className="message-body">{message.body}</p>
                </article>
              </div>
            )
          })}
        </div>
      </div>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
