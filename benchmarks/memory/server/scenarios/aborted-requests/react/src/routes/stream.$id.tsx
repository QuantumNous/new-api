import { Await, createFileRoute } from '@tanstack/react-router'
import { Suspense } from 'react'
import { makeAbortedRequestRecords } from '../../../deferred-records'

function resolveAfterMicrotasks<T>(microtasks: number, value: () => T) {
  let promise = Promise.resolve()

  for (let index = 0; index < microtasks; index++) {
    promise = promise.then(() => undefined)
  }

  return promise.then(value)
}

export const Route = createFileRoute('/stream/$id')({
  loader: ({ params }) => ({
    eager: `eager-${params.id}`,
    alpha: resolveAfterMicrotasks(32, () =>
      makeAbortedRequestRecords(params.id, 'alpha'),
    ),
    beta: resolveAfterMicrotasks(64, () =>
      makeAbortedRequestRecords(params.id, 'beta'),
    ),
  }),
  component: StreamComponent,
})

function StreamComponent() {
  const data = Route.useLoaderData()

  return (
    <main data-bench="aborted-requests-stream">
      <p data-bench="aborted-requests-eager">{data.eager}</p>
      <Suspense
        fallback={
          <p data-bench="aborted-requests-alpha-fallback">loading-alpha</p>
        }
      >
        <Await promise={data.alpha}>
          {(records) => (
            <ul data-bench="aborted-requests-alpha">
              {records.map((record) => (
                <li key={record.id}>{record.label}</li>
              ))}
            </ul>
          )}
        </Await>
      </Suspense>
      <Suspense
        fallback={
          <p data-bench="aborted-requests-beta-fallback">loading-beta</p>
        }
      >
        <Await promise={data.beta}>
          {(records) => (
            <ul data-bench="aborted-requests-beta">
              {records.map((record) => (
                <li key={record.id}>{record.label}</li>
              ))}
            </ul>
          )}
        </Await>
      </Suspense>
    </main>
  )
}
