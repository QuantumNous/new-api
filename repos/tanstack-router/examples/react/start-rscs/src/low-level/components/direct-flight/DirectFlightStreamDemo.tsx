import { useCallback, useState } from 'react'
import { createFromReadableStream } from '@tanstack/react-start/rsc'

import { getFlightStreamDirect } from './server-functions'

export function DirectFlightStreamDemo() {
  const [result, setResult] = useState<React.ReactNode | null>(null)
  const [loading, setLoading] = useState(false)
  const [streamInfo, setStreamInfo] = useState<string>('')

  const loadStream = useCallback(async () => {
    setLoading(true)
    setStreamInfo('Fetching Flight stream from server function...')

    try {
      const stream = await getFlightStreamDirect()
      setStreamInfo('Decoding Flight stream with createFromReadableStream...')

      // Use createFromReadableStream to decode the Flight stream
      const element = await createFromReadableStream(stream)
      setResult(element as React.ReactNode)
      setStreamInfo('Stream decoded successfully!')
    } catch (error) {
      setStreamInfo(`Error: ${error}`)
    } finally {
      setLoading(false)
    }
  }, [])

  return (
    <div className="space-y-4">
      <button
        onClick={loadStream}
        disabled={loading}
        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Loading...' : 'Load Flight Stream'}
      </button>

      {streamInfo && (
        <div className="text-sm text-gray-600 font-mono bg-gray-100 p-2 rounded">
          {streamInfo}
        </div>
      )}

      {result && (
        <div className="border-2 border-dashed border-purple-300 rounded-lg p-2">
          <div className="text-xs text-purple-600 mb-2 font-medium">
            Server-Rendered Content:
          </div>
          {result}
        </div>
      )}
    </div>
  )
}
