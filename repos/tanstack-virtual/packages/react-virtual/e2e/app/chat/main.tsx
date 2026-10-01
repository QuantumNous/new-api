import React from 'react'
import { createRoot } from 'react-dom/client'
import { useVirtualizer } from '@tanstack/react-virtual'

type Message = {
  id: string
  text: string
  height: number
}

const makeMessage = (index: number): Message => ({
  id: `m-${index}`,
  text: `Message ${index}`,
  height: 50,
})

const initialMessages = Array.from({ length: 30 }, (_, index) =>
  makeMessage(index),
)

function App() {
  const [messages, setMessages] = React.useState(initialMessages)
  const [didInitialScroll, setDidInitialScroll] = React.useState(false)
  const parentRef = React.useRef<HTMLDivElement>(null)
  const firstMessageIndexRef = React.useRef(0)
  const nextMessageIndexRef = React.useRef(initialMessages.length)

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50,
    getItemKey: (index) => messages[index]!.id,
    anchorTo: 'end',
    followOnAppend: true,
    scrollEndThreshold: 4,
    overscan: 4,
  })

  React.useLayoutEffect(() => {
    if (didInitialScroll) return
    virtualizer.scrollToEnd()
    setDidInitialScroll(true)
  }, [didInitialScroll, virtualizer])

  return (
    <div>
      <button
        id="prepend"
        onClick={() => {
          const start = firstMessageIndexRef.current - 5
          firstMessageIndexRef.current = start
          setMessages((current) => [
            ...Array.from({ length: 5 }, (_, offset) =>
              makeMessage(start + offset),
            ),
            ...current,
          ])
        }}
      >
        Prepend
      </button>
      <button
        id="append"
        onClick={() => {
          const next = nextMessageIndexRef.current
          nextMessageIndexRef.current += 1
          setMessages((current) => [...current, makeMessage(next)])
        }}
      >
        Append
      </button>
      <button
        id="grow-last"
        onClick={() => {
          setMessages((current) =>
            current.map((message, index) =>
              index === current.length - 1
                ? { ...message, text: `${message.text} streaming`, height: 140 }
                : message,
            ),
          )
        }}
      >
        Grow last
      </button>
      <button id="scroll-to-end" onClick={() => virtualizer.scrollToEnd()}>
        End
      </button>

      <div
        ref={parentRef}
        id="scroll-container"
        style={{
          height: 300,
          overflow: 'auto',
          width: 420,
          border: '1px solid #ddd',
        }}
      >
        <div
          style={{
            height: virtualizer.getTotalSize(),
            position: 'relative',
            width: '100%',
          }}
        >
          {virtualizer.getVirtualItems().map((item) => {
            const message = messages[item.index]!

            return (
              <div
                key={item.key}
                ref={virtualizer.measureElement}
                data-index={item.index}
                data-message-id={message.id}
                data-testid={`message-${message.id}`}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  transform: `translateY(${item.start}px)`,
                  width: '100%',
                }}
              >
                <div
                  style={{
                    boxSizing: 'border-box',
                    height: message.height,
                    padding: 8,
                    borderBottom: '1px solid #eee',
                  }}
                >
                  {message.text}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
