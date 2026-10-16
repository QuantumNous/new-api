import { useCallback, useEffect, useState } from 'react'
import { createFromReadableStream } from '@tanstack/react-start/rsc'

import { db } from '../../db'
import { getCounterRscPayload } from './server-functions'

// Convert string payload back to ReadableStream
function payloadToStream(payload: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(payload))
      controller.close()
    },
  })
}

export function DexieCacheDemo() {
  const [counter, setCounter] = useState(0)
  const [result, setResult] = useState<React.ReactNode | null>(null)
  const [loading, setLoading] = useState(false)
  const [source, setSource] = useState<'cache' | 'server' | null>(null)
  const [cacheStats, setCacheStats] = useState({ count: 0, size: 0 })
  const [loadTime, setLoadTime] = useState<number | null>(null)

  // Load cache stats on mount and after operations
  const updateCacheStats = useCallback(async () => {
    const entries = await db.cache.toArray()
    const totalSize = entries.reduce((sum, e) => sum + e.payload.length, 0)
    setCacheStats({ count: entries.length, size: totalSize })
  }, [])

  const loadRsc = useCallback(
    async (count: number) => {
      setLoading(true)
      setSource(null)
      setLoadTime(null)
      const startTime = performance.now()

      try {
        const cacheKey = `counter-${count}`

        // Check if cached in Dexie
        const cached = await db.cache.get(cacheKey)

        if (cached) {
          // Load from cache
          console.log(`[Client] Cache HIT for counter: ${count}`)
          const stream = payloadToStream(cached.payload)
          const element = await createFromReadableStream(stream)
          setResult(element as React.ReactNode)
          setSource('cache')
        } else {
          // Fetch from server
          console.log(`[Client] Cache MISS for counter: ${count}`)
          const { payload } = await getCounterRscPayload({ data: { count } })

          // Store in Dexie
          await db.cache.put({
            id: cacheKey,
            payload,
            createdAt: Date.now(),
          })

          // Decode and render
          const stream = payloadToStream(payload)
          const element = await createFromReadableStream(stream)
          setResult(element as React.ReactNode)
          setSource('server')
          await updateCacheStats()
        }

        setLoadTime(performance.now() - startTime)
      } catch (error) {
        console.error('Error loading RSC:', error)
      } finally {
        setLoading(false)
      }
    },
    [updateCacheStats],
  )

  // Auto-load RSC when counter changes
  useEffect(() => {
    loadRsc(counter)
  }, [counter, loadRsc])

  // Load cache stats on mount
  useEffect(() => {
    updateCacheStats()
  }, [updateCacheStats])

  const clearCache = useCallback(async () => {
    await db.cache.clear()
    await updateCacheStats()
    setResult(null)
    setSource(null)
    setLoadTime(null)
  }, [updateCacheStats])

  return (
    <div className="space-y-4">
      {/* Counter controls */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setCounter((c) => Math.max(0, c - 1))}
          disabled={loading}
          className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 disabled:opacity-50 transition-colors font-bold"
        >
          -
        </button>
        <div className="text-2xl font-bold text-gray-900 min-w-[60px] text-center">
          {counter}
        </div>
        <button
          onClick={() => setCounter((c) => c + 1)}
          disabled={loading}
          className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 disabled:opacity-50 transition-colors font-bold"
        >
          +
        </button>
        <button
          onClick={clearCache}
          className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
        >
          Clear Cache
        </button>
      </div>

      {/* Cache stats */}
      <div className="flex gap-4 text-sm">
        <div className="px-3 py-1 bg-gray-100 rounded-full">
          <span className="text-gray-500">Cached entries:</span>{' '}
          <span className="font-bold text-gray-700">{cacheStats.count}</span>
        </div>
        <div className="px-3 py-1 bg-gray-100 rounded-full">
          <span className="text-gray-500">Cache size:</span>{' '}
          <span className="font-bold text-gray-700">
            {(cacheStats.size / 1024).toFixed(2)} KB
          </span>
        </div>
      </div>

      {/* Source indicator */}
      {loading ? (
        <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 text-gray-600">
          <div className="w-3 h-3 rounded-full bg-gray-400 animate-pulse" />
          <span className="font-medium">Loading...</span>
        </div>
      ) : (
        source && (
          <div
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg ${
              source === 'cache'
                ? 'bg-green-100 text-green-800'
                : 'bg-blue-100 text-blue-800'
            }`}
          >
            <div
              className={`w-3 h-3 rounded-full ${
                source === 'cache' ? 'bg-green-500' : 'bg-blue-500'
              }`}
            />
            <span className="font-medium">
              {source === 'cache'
                ? 'Loaded from Dexie cache'
                : 'Fetched from server'}
            </span>
            {loadTime !== null && (
              <span className="text-xs opacity-75">
                ({loadTime.toFixed(1)}ms)
              </span>
            )}
          </div>
        )
      )}

      {/* Result */}
      {result && (
        <div className="border-2 border-dashed border-cyan-300 rounded-lg p-2">
          <div className="text-xs text-cyan-600 mb-2 font-medium">
            RSC for Counter #{counter}:
          </div>
          {result}
        </div>
      )}

      {/* How it works */}
      <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
        <strong>How it works:</strong> When you change the counter, the app
        automatically checks Dexie (IndexedDB) for a cached Flight payload. If
        found, it decodes the cached string directly. If not found, it fetches
        from the server, stores the payload in Dexie, then decodes it. Each
        counter value gets its own cache entry with unique server-generated
        data.
      </div>
    </div>
  )
}
