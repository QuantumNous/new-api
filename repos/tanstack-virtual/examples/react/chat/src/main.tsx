import React from 'react'
import { createRoot } from 'react-dom/client'
import { useVirtualizer } from '@tanstack/react-virtual'
import './index.css'

type Message = {
  id: string
  author: 'user' | 'assistant'
  text: string
}

const replies = [
  'I can break that into the smallest next step and keep the current viewport pinned while this answer grows.',
  'Older messages are loaded above the viewport. The visible row keeps the same screen position after the prepend.',
  'When the thread is not at the bottom, new output waits below without pulling the reader away from history.',
]

const makeMessage = (index: number): Message => ({
  id: `message-${index}`,
  author: index % 4 === 0 ? 'user' : 'assistant',
  text:
    index % 4 === 0
      ? `Can you check item ${index}?`
      : `Message ${index}: ${replies[Math.abs(index) % replies.length]}`,
})

const initialMessages = Array.from({ length: 45 }, (_, index) =>
  makeMessage(index),
)

function App() {
  const parentRef = React.useRef<HTMLDivElement>(null)
  const firstMessageIndexRef = React.useRef(0)
  const nextMessageIndexRef = React.useRef(initialMessages.length)
  const streamTimerRef = React.useRef<number | null>(null)
  const loadingHistoryRef = React.useRef(false)
  const [messages, setMessages] = React.useState(initialMessages)
  const [loadingHistory, setLoadingHistory] = React.useState(false)
  const [didInitialScroll, setDidInitialScroll] = React.useState(false)
  const [autoHistoryEnabled, setAutoHistoryEnabled] = React.useState(false)

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 74,
    getItemKey: React.useCallback(
      (index: number) => messages[index]!.id,
      [messages],
    ),
    anchorTo: 'end',
    followOnAppend: true,
    scrollEndThreshold: 80,
    overscan: 6,
    directDomUpdates: true,
  })

  const virtualItems = virtualizer.getVirtualItems()

  const prependHistory = React.useCallback(() => {
    if (loadingHistoryRef.current || firstMessageIndexRef.current <= -90) {
      return
    }

    loadingHistoryRef.current = true
    setLoadingHistory(true)
    window.setTimeout(() => {
      const start = firstMessageIndexRef.current - 12
      firstMessageIndexRef.current = start
      setMessages((current) => [
        ...Array.from({ length: 12 }, (_, offset) =>
          makeMessage(start + offset),
        ),
        ...current,
      ])
      loadingHistoryRef.current = false
      setLoadingHistory(false)
    }, 180)
  }, [])

  const appendMessage = React.useCallback(() => {
    const next = nextMessageIndexRef.current
    nextMessageIndexRef.current += 1
    setMessages((current) => [...current, makeMessage(next)])
  }, [])

  const streamReply = React.useCallback(() => {
    if (streamTimerRef.current !== null) return

    const id = `stream-${Date.now()}`
    const chunks = [
      'Thinking through the failure mode.',
      ' The list should follow only when it was already pinned.',
      ' Prepends should keep the reader anchored to the same message.',
      ' Streaming output should grow without drifting off the bottom.',
    ]
    let chunkIndex = 0

    setMessages((current) => [
      ...current,
      {
        id,
        author: 'assistant',
        text: '',
      },
    ])

    streamTimerRef.current = window.setInterval(() => {
      setMessages((current) =>
        current.map((message) =>
          message.id === id
            ? {
                ...message,
                text: chunks.slice(0, chunkIndex + 1).join(''),
              }
            : message,
        ),
      )

      chunkIndex += 1
      if (chunkIndex === chunks.length && streamTimerRef.current !== null) {
        window.clearInterval(streamTimerRef.current)
        streamTimerRef.current = null
      }
    }, 280)
  }, [])

  React.useLayoutEffect(() => {
    if (didInitialScroll) return
    virtualizer.scrollToEnd()
    setDidInitialScroll(true)
  }, [didInitialScroll, virtualizer])

  React.useEffect(() => {
    const id = window.setTimeout(() => {
      setAutoHistoryEnabled(true)
    }, 250)

    return () => window.clearTimeout(id)
  }, [])

  React.useEffect(() => {
    return () => {
      if (streamTimerRef.current !== null) {
        window.clearInterval(streamTimerRef.current)
      }
    }
  }, [])

  return (
    <div className="App">
      <div className="Toolbar">
        <div className="ToolbarGroup">
          <button type="button" onClick={prependHistory}>
            Load older
          </button>
          <button type="button" onClick={appendMessage}>
            Add message
          </button>
          <button type="button" onClick={streamReply}>
            Stream reply
          </button>
          <button type="button" onClick={() => virtualizer.scrollToEnd()}>
            Latest
          </button>
        </div>
        <div className="Status">
          {loadingHistory
            ? 'Loading history'
            : virtualizer.isAtEnd(80)
              ? 'At latest'
              : 'Reading history'}
        </div>
      </div>

      <div className="Shell">
        <div
          ref={parentRef}
          className="Messages"
          onScroll={(event) => {
            if (!autoHistoryEnabled || virtualizer.isAtEnd(80)) return
            if (event.currentTarget.scrollTop < 120) {
              prependHistory()
            }
          }}
        >
          <div
            ref={virtualizer.containerRef}
            style={{
              position: 'relative',
              width: '100%',
            }}
          >
            {virtualItems.map((virtualItem) => {
              const message = messages[virtualItem.index]!

              return (
                <div
                  key={virtualItem.key}
                  ref={virtualizer.measureElement}
                  data-index={virtualItem.index}
                  className="MessageRow"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                  }}
                >
                  <div className={`Bubble Bubble-${message.author}`}>
                    <div className="Meta">{message.author}</div>
                    {message.text || '...'}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
