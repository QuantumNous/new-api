import { Await, createFileRoute } from '@tanstack/vue-router'
import { Suspense } from 'vue'
import {
  makeDeferredSectionPayload,
  type DeferredSectionPayload,
} from '../../../deferred-section-data'

const fallbackFlushTicks = 20

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

// Deferred sections must settle strictly AFTER Vue's shell has a chance to
// flush, so fallbacks are emitted before deferred section content.
// Chained 0ms timers-phase hops give the renderer a deterministic number of
// full event-loop turns to flush, instead of a wall-clock delay whose margin
// varies with runner load; distinct hop counts keep section ordering stable.
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
    { index: 0, promise: data.value.deferred0 },
    { index: 1, promise: data.value.deferred1 },
    { index: 2, promise: data.value.deferred2 },
    { index: 3, promise: data.value.deferred3 },
  ] as const

  return (
    <main data-bench="streaming-peak-page">
      <h1>{data.value.eager}</h1>
      {deferredSections.map(({ index, promise }) => (
        <>
          <p data-bench={`streaming-peak-fallback-${index}`}>
            streaming-peak-fallback-{index}
          </p>
          <Suspense key={index}>
            {{
              default: () => (
                <Await
                  promise={promise}
                  children={(section: DeferredSectionPayload) => (
                    <DeferredSection section={section} />
                  )}
                />
              ),
              fallback: () => null,
            }}
          </Suspense>
        </>
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
