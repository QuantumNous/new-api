import { Await, createFileRoute } from '@tanstack/react-router'
import { Suspense } from 'react'
import {
  makeDeferredSectionPayload,
  type DeferredSectionPayload,
} from '../../../deferred-section-data'

const fallbackFlushTicks = 4

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
// stops exercising multi-flush streaming. Timers-phase callbacks reliably
// lose that race, but a millisecond delay makes the loss margin wall-clock
// dependent, so this chains 0ms hops instead: each hop yields one full
// event-loop turn (immediates and microtasks included), making the flush
// ordering a function of turn count, not runner speed. Distinct hop counts
// keep section ordering deterministic.
function afterFallbackFlush(sectionIndex: number) {
  return new Promise<void>((resolve) => {
    let remaining = fallbackFlushTicks + sectionIndex

    const step = () => {
      remaining -= 1

      if (remaining <= 0) {
        resolve()
        return
      }

      setTimeout(step, 0)
    }

    setTimeout(step, 0)
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
