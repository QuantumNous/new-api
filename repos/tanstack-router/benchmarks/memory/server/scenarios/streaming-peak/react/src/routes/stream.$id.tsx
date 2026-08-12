import { Await, createFileRoute } from '@tanstack/react-router'
import { Suspense } from 'react'
import {
  makeDeferredSectionPayload,
  type DeferredSectionPayload,
} from '../../../deferred-section-data'

const fallbackFlushDelayMs = 1

export const Route = createFileRoute('/stream/$id')({
  loader: ({ params }) => ({
    eager: `streaming-peak-eager-${params.id}`,
    deferred0: makeDeferredSection(params.id, 0),
    deferred1: makeDeferredSection(params.id, 1),
    deferred2: makeDeferredSection(params.id, 2),
    deferred3: makeDeferredSection(params.id, 3),
  }),
  component: StreamComponent,
})

// Deferred sections must settle strictly AFTER React's shell flush, which
// React schedules via setImmediate internally. Microtask chains drain during
// router load (sections resolve before the Suspense boundaries are even
// reached) and setImmediate chains registered at loader time win the race
// against React's flush — either way no fallback ever streams and the bench
// stops exercising multi-flush streaming. Timer-phase callbacks reliably lose
// that race, so this is the documented exception to the no-timers convention:
// the few ms of wall-clock are irrelevant to memory metrics, and distinct
// delays keep section ordering deterministic.
function afterFallbackFlush(sectionIndex: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, fallbackFlushDelayMs + sectionIndex)
  })
}

function makeDeferredSection(id: string, sectionIndex: number) {
  return afterFallbackFlush(sectionIndex).then(() =>
    makeDeferredSectionPayload(id, sectionIndex),
  )
}

function StreamComponent() {
  const data = Route.useLoaderData()
  const deferredSections = [
    { index: 0, promise: data.deferred0 },
    { index: 1, promise: data.deferred1 },
    { index: 2, promise: data.deferred2 },
    { index: 3, promise: data.deferred3 },
  ] as const

  return (
    <main data-bench="streaming-peak-page">
      <h1>{data.eager}</h1>
      {deferredSections.map(({ index, promise }) => (
        <Suspense
          key={index}
          fallback={
            <p data-bench={`streaming-peak-fallback-${index}`}>
              streaming-peak-fallback-{index}
            </p>
          }
        >
          <Await promise={promise}>
            {(section) => <DeferredSection section={section} />}
          </Await>
        </Suspense>
      ))}
    </main>
  )
}

function DeferredSection({ section }: { section: DeferredSectionPayload }) {
  const marker = `streaming-peak-deferred-${section.index}`

  return (
    <section data-bench={marker}>
      <h2>{marker}</h2>
      {section.records.map((record) => (
        <p key={record.id}>{record.value}</p>
      ))}
    </section>
  )
}
