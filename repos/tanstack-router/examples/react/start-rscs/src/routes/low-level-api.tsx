import { createFileRoute } from '@tanstack/react-router'

import {
  DemoSection,
  DexieCacheDemo,
  DirectFlightStreamDemo,
  FetchFlightStreamDemo,
  NestedSuspenseDemo,
  ParallelStreamsDemo,
  StreamingTicker,
} from '~/low-level'

export const Route = createFileRoute('/low-level-api')({
  component: LowLevelApiPage,
})

function LowLevelApiPage() {
  return (
    <div className="py-10">
      <div className="max-w-4xl mx-auto px-4">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Low-Level RSC Primitives
          </h1>
          <p className="text-gray-600 mt-2">
            Demonstrating TanStack Start's low-level Flight stream APIs
          </p>
        </header>

        <div className="space-y-8">
          {/* Demo 1: Direct Flight Stream */}
          <DemoSection
            title="1. Direct Flight Stream"
            description="Uses renderToReadableStream to create a Flight stream and createFromReadableStream to decode it"
          >
            <DirectFlightStreamDemo />
          </DemoSection>

          {/* Demo 2: Fetch-based Flight Stream */}
          <DemoSection
            title="2. API Route Flight Stream"
            description="Fetches a Flight stream from an API route using createFromFetch"
          >
            <FetchFlightStreamDemo />
          </DemoSection>

          {/* Demo 3: Parallel Streams */}
          <DemoSection
            title="3. Parallel Flight Streams"
            description="Multiple independent streams loading in parallel with different delays"
          >
            <ParallelStreamsDemo />
          </DemoSection>

          {/* Demo 4: Nested with Suspense */}
          <DemoSection
            title="4. Nested Server Components with Suspense"
            description="Server-side Suspense boundaries that stream progressively"
          >
            <NestedSuspenseDemo />
          </DemoSection>

          {/* Demo 5: Dexie Cache */}
          <DemoSection
            title="5. Dexie IndexedDB Cache"
            description="Caches RSC Flight payloads in IndexedDB using Dexie. Change the counter to load from cache or server."
          >
            <DexieCacheDemo />
          </DemoSection>

          {/* Demo 6: HTTP Streaming Ticker */}
          <DemoSection
            title="6. HTTP Streaming RSC Ticker"
            description="Streams RSC Flight payloads from a server function using async generators. Each item is a server-rendered component with live client-side timestamps."
          >
            <StreamingTicker />
          </DemoSection>
        </div>
      </div>
    </div>
  )
}
