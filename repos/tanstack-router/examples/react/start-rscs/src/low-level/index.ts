// Shared components
export { DemoSection } from './components/DemoSection'

// Demo 1: Direct Flight Stream
export { DirectFlightStreamDemo } from './components/direct-flight/DirectFlightStreamDemo'
export { getFlightStreamDirect } from './components/direct-flight/server-functions'

// Demo 2: Fetch Flight Stream (uses /api/rsc route)
export { FetchFlightStreamDemo } from './components/fetch-flight/FetchFlightStreamDemo'

// Demo 3: Parallel Streams
export { ParallelStreamsDemo } from './components/parallel-streams/ParallelStreamsDemo'
export { getParallelStreams } from './components/parallel-streams/server-functions'

// Demo 4: Nested Suspense
export { NestedSuspenseDemo } from './components/nested-suspense/NestedSuspenseDemo'
export { getNestedServerComponent } from './components/nested-suspense/server-functions'

// Demo 5: Dexie Cache
export { DexieCacheDemo } from './components/dexie-cache/DexieCacheDemo'
export { getCounterRscPayload } from './components/dexie-cache/server-functions'

// Demo 6: Streaming Ticker
export { StreamingTicker } from './components/streaming-ticker/StreamingTicker'
export { streamTickerRscs } from './components/streaming-ticker/server-functions'

// Dexie database
export { db } from './db'
export type { RscCacheEntry } from './db'
