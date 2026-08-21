import { Await, createFileRoute } from '@tanstack/vue-router'
import { Suspense } from 'vue'
import {
  makeAbortedRequestRecords,
  type DeferredRecord,
  type RecordGroup,
} from '../../../deferred-records'

const alphaResolveTicks = 4
const betaResolveTicks = 6
const abortProbeAlphaResolveTicks = 40
const abortProbeBetaResolveTicks = 60

function isAbortProbeId(id: string) {
  return id === 'sanity-mid-stream' || id.startsWith('abort-')
}

function getResolveTicks(id: string, group: RecordGroup) {
  if (isAbortProbeId(id)) {
    return group === 'alpha'
      ? abortProbeAlphaResolveTicks
      : abortProbeBetaResolveTicks
  }

  return group === 'alpha' ? alphaResolveTicks : betaResolveTicks
}

// One tick = one 0ms timers-phase hop. Counting event-loop turns instead of
// milliseconds keeps the resolve/abort interleaving a pure function of the
// event-loop schedule: a wall-clock delay races the abort differently
// depending on runner load and instrumentation overhead, which made this
// benchmark's single measured run swing between runs.
function resolveAfterTicks<T>(
  ticks: number,
  signal: AbortSignal,
  value: () => T,
  abortedValue: () => T,
) {
  return new Promise<T>((resolve) => {
    if (signal.aborted) {
      resolve(abortedValue())
      return
    }

    let remaining = ticks
    let timeoutId: ReturnType<typeof setTimeout>

    const onAbort = () => {
      clearTimeout(timeoutId)
      resolve(abortedValue())
    }

    const step = () => {
      remaining -= 1

      if (remaining <= 0) {
        signal.removeEventListener('abort', onAbort)
        resolve(value())
        return
      }

      timeoutId = setTimeout(step, 0)
    }

    signal.addEventListener('abort', onAbort, { once: true })
    timeoutId = setTimeout(step, 0)
  })
}

function makeDeferredRecords(
  id: string,
  group: RecordGroup,
  signal: AbortSignal,
) {
  return resolveAfterTicks(
    getResolveTicks(id, group),
    signal,
    () => makeAbortedRequestRecords(id, group),
    () => [],
  )
}

export const Route = createFileRoute('/stream/$id')({
  loader: ({ params, abortController }) => ({
    eager: `eager-${params.id}`,
    alpha: makeDeferredRecords(params.id, 'alpha', abortController.signal),
    beta: makeDeferredRecords(params.id, 'beta', abortController.signal),
  }),
  component: StreamComponent,
})

function StreamComponent() {
  const data = Route.useLoaderData()

  return (
    <main data-bench="aborted-requests-stream">
      <p data-bench="aborted-requests-eager">{data.value.eager}</p>
      <p data-bench="aborted-requests-alpha-fallback">loading-alpha</p>
      <p data-bench="aborted-requests-beta-fallback">loading-beta</p>
      <Suspense>
        {{
          default: () => (
            <Await
              promise={data.value.alpha}
              children={(records: Array<DeferredRecord>) => (
                <ul data-bench="aborted-requests-alpha">
                  {records.map((record) => (
                    <li key={record.id}>{record.label}</li>
                  ))}
                </ul>
              )}
            />
          ),
          fallback: () => null,
        }}
      </Suspense>
      <Suspense>
        {{
          default: () => (
            <Await
              promise={data.value.beta}
              children={(records: Array<DeferredRecord>) => (
                <ul data-bench="aborted-requests-beta">
                  {records.map((record) => (
                    <li key={record.id}>{record.label}</li>
                  ))}
                </ul>
              )}
            />
          ),
          fallback: () => null,
        }}
      </Suspense>
    </main>
  )
}
