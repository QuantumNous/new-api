import { useCallback, useState } from 'react'
import { createFromFetch } from '@tanstack/react-start/rsc'

export function FetchFlightStreamDemo() {
  const [result, setResult] = useState<React.ReactNode | null>(null)
  const [loading, setLoading] = useState(false)

  const loadFromApi = useCallback(async () => {
    setLoading(true)
    try {
      // Use createFromFetch to decode a Flight stream from a fetch response
      const element = await createFromFetch(fetch('/api/rsc'))
      setResult(element as React.ReactNode)
    } catch (error) {
      console.error('Error fetching RSC:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  return (
    <div className="space-y-4">
      <button
        onClick={loadFromApi}
        disabled={loading}
        className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Fetching...' : 'Fetch from /api/rsc'}
      </button>

      {result && (
        <div className="border-2 border-dashed border-emerald-300 rounded-lg p-2">
          <div className="text-xs text-emerald-600 mb-2 font-medium">
            API Route Response:
          </div>
          {result}
        </div>
      )}
    </div>
  )
}
