import { Await, createFileRoute } from '@tanstack/vue-router'
import { Suspense, defineComponent } from 'vue'
import { makeBigPayload, sleep0 } from '../../../shared-data'
import type { BigPayload, SmallPayload } from '../../../shared-data'

const StreamComponent = defineComponent({
  setup() {
    const data = Route.useLoaderData()

    return () => (
      <>
        <p>{data.value.fast.label}</p>
        <p>loading-small</p>
        <Suspense>
          {{
            default: () => (
              <Await
                promise={data.value.slowSmall}
                children={(d: SmallPayload) => <p>{d.label}</p>}
              />
            ),
            fallback: () => null,
          }}
        </Suspense>
        <p>loading-big</p>
        <Suspense>
          {{
            default: () => (
              <Await
                promise={data.value.slowBig}
                children={(d: BigPayload) => (
                  <section>
                    <h2>{d.label}</h2>
                    {d.chunks.map((chunk) => (
                      <p key={chunk.index}>{chunk.value}</p>
                    ))}
                  </section>
                )}
              />
            ),
            fallback: () => null,
          }}
        </Suspense>
      </>
    )
  },
})

export const Route = createFileRoute('/stream/$id')({
  loader: ({ params }) => ({
    fast: { label: `fast-${params.id}` },
    slowSmall: sleep0().then(() => ({ label: `slow-small-${params.id}` })),
    slowBig: sleep0().then(() => makeBigPayload(params.id)),
  }),
  component: StreamComponent,
})
