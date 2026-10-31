import { Suspense, useCallback, useState } from 'react'
import { createFromReadableStream } from '@tanstack/react-start/rsc'

import { getNestedServerComponent } from './server-functions'

export function NestedSuspenseDemo() {
  const [result, setResult] = useState<React.ReactNode | null>(null)
  const [loading, setLoading] = useState(false)

  const loadNested = useCallback(async () => {
    setLoading(true)
    try {
      const stream = await getNestedServerComponent()
      const element = await createFromReadableStream(stream)
      setResult(element as React.ReactNode)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  return (
    <div className="space-y-4">
      <button
        onClick={loadNested}
        disabled={loading}
        className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Loading...' : 'Load Nested Components'}
      </button>

      {result && (
        <div className="border-2 border-dashed border-rose-300 rounded-lg p-2">
          <div className="text-xs text-rose-600 mb-2 font-medium">
            Nested Server Components with Suspense:
          </div>
          <Suspense fallback={<div className="animate-pulse">Loading...</div>}>
            {result}
          </Suspense>
        </div>
      )}
    </div>
  )
}
