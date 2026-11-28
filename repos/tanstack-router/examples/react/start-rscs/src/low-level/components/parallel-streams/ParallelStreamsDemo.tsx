import { useCallback, useState } from 'react'
import { createFromReadableStream } from '@tanstack/react-start/rsc'

import { getParallelStreams } from './server-functions'

export function ParallelStreamsDemo() {
  const [streams, setStreams] = useState<{
    card1: React.ReactNode | null
    card2: React.ReactNode | null
    card3: React.ReactNode | null
  }>({ card1: null, card2: null, card3: null })
  const [loading, setLoading] = useState(false)
  const [timing, setTiming] = useState<Array<string>>([])

  const loadParallel = useCallback(async () => {
    setLoading(true)
    setStreams({ card1: null, card2: null, card3: null })
    setTiming([])

    const startTime = Date.now()
    const addTiming = (label: string) => {
      const elapsed = Date.now() - startTime
      setTiming((prev) => [...prev, `${label}: ${elapsed}ms`])
    }

    try {
      const { stream1, stream2, stream3 } = await getParallelStreams()
      addTiming('Streams received')

      // Decode streams in parallel
      const [el1, el2, el3] = await Promise.all([
        createFromReadableStream(stream1).then((el) => {
          addTiming('Card 1 decoded')
          return el
        }),
        createFromReadableStream(stream2).then((el) => {
          addTiming('Card 2 decoded')
          return el
        }),
        createFromReadableStream(stream3).then((el) => {
          addTiming('Card 3 decoded')
          return el
        }),
      ])

      setStreams({
        card1: el1 as React.ReactNode,
        card2: el2 as React.ReactNode,
        card3: el3 as React.ReactNode,
      })
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  return (
    <div className="space-y-4">
      <button
        onClick={loadParallel}
        disabled={loading}
        className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Loading...' : 'Load Parallel Streams'}
      </button>

      {timing.length > 0 && (
        <div className="text-xs font-mono bg-gray-100 p-2 rounded space-y-1">
          {timing.map((t, i) => (
            <div key={i} className="text-gray-600">
              {t}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        {[streams.card1, streams.card2, streams.card3].map((card, i) => (
          <div
            key={i}
            className="border-2 border-dashed border-amber-300 rounded-lg p-2 min-h-[100px]"
          >
            <div className="text-xs text-amber-600 mb-2 font-medium">
              Card {i + 1}
            </div>
            {card || (
              <div className="animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-16 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-24" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
