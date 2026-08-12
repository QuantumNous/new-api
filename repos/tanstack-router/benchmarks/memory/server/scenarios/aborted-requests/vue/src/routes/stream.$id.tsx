import { Await, createFileRoute } from '@tanstack/vue-router'
import { Suspense } from 'vue'
import {
  makeAbortedRequestRecords,
  type DeferredRecord,
  type RecordGroup,
} from '../../../deferred-records'

const alphaDelayMs = 50
const betaDelayMs = 75
const abortProbeAlphaDelayMs = 500
const abortProbeBetaDelayMs = 750

function isAbortProbeId(id: string) {
  return id === 'sanity-mid-stream' || id.startsWith('abort-')
}

function getDelay(id: string, group: RecordGroup) {
  if (isAbortProbeId(id)) {
    return group === 'alpha' ? abortProbeAlphaDelayMs : abortProbeBetaDelayMs
  }

  return group === 'alpha' ? alphaDelayMs : betaDelayMs
}

function resolveAfterDelay<T>(
  delayMs: number,
  signal: AbortSignal,
  value: () => T,
  abortedValue: () => T,
) {
  return new Promise<T>((resolve) => {
    if (signal.aborted) {
      resolve(abortedValue())
      return
    }

    const timeoutId = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve(value())
    }, delayMs)

    const onAbort = () => {
      clearTimeout(timeoutId)
      resolve(abortedValue())
    }

    signal.addEventListener('abort', onAbort, { once: true })
  })
}

function makeDeferredRecords(
  id: string,
  group: RecordGroup,
  signal: AbortSignal,
) {
  const delayMs = getDelay(id, group)

  return resolveAfterDelay(
    delayMs,
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
