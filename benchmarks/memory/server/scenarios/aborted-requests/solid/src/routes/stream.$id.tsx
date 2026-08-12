import { createFileRoute } from '@tanstack/solid-router'
import { Show, Suspense, createResource } from 'solid-js'
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
      <p data-bench="aborted-requests-eager">{data().eager}</p>
      <Suspense
        fallback={
          <p data-bench="aborted-requests-alpha-fallback">loading-alpha</p>
        }
      >
        <DeferredRecords
          promise={data().alpha}
          dataBench="aborted-requests-alpha"
        />
      </Suspense>
      <Suspense
        fallback={
          <p data-bench="aborted-requests-beta-fallback">loading-beta</p>
        }
      >
        <DeferredRecords
          promise={data().beta}
          dataBench="aborted-requests-beta"
        />
      </Suspense>
    </main>
  )
}

function DeferredRecords(props: {
  promise: Promise<Array<DeferredRecord>>
  dataBench: string
}) {
  const [records] = createResource(
    () => props.promise,
    (promise) => promise,
  )

  return (
    <Show when={records()}>
      {(resolvedRecords) => (
        <ul data-bench={props.dataBench}>
          {resolvedRecords().map((record) => (
            <li>{record.label}</li>
          ))}
        </ul>
      )}
    </Show>
  )
}
