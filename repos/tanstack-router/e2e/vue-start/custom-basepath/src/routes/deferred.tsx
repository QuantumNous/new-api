import { Await, createFileRoute } from '@tanstack/vue-router'
import { createServerFn } from '@tanstack/vue-start'
import { Suspense, defineComponent, ref } from 'vue'

const personServerFn = createServerFn({ method: 'GET' })
  .validator((data: { name: string }) => data)
  .handler(({ data }) => {
    return { name: data.name, randomNumber: Math.floor(Math.random() * 100) }
  })

const slowServerFn = createServerFn({ method: 'GET' })
  .validator((data: { name: string }) => data)
  .handler(async ({ data }) => {
    await new Promise((r) => setTimeout(r, 1000))
    return { name: data.name, randomNumber: Math.floor(Math.random() * 100) }
  })

const Deferred = defineComponent({
  setup() {
    const count = ref(0)
    const loaderData = Route.useLoaderData()

    return () => (
      <div class="p-2">
        <div data-testid="regular-person">
          {loaderData.value.person.name} -{' '}
          {loaderData.value.person.randomNumber}
        </div>
        <Suspense>
          {{
            default: () => (
              <Await
                promise={loaderData.value.deferredPerson}
                children={(data: { name: string; randomNumber: number }) => (
                  <div data-testid="deferred-person">
                    {data.name} - {data.randomNumber}
                  </div>
                )}
              />
            ),
            fallback: () => <div>Loading person...</div>,
          }}
        </Suspense>
        <Suspense>
          {{
            default: () => (
              <Await
                promise={loaderData.value.deferredStuff}
                children={(data: string) => (
                  <h3 data-testid="deferred-stuff">{data}</h3>
                )}
              />
            ),
            fallback: () => <div>Loading stuff...</div>,
          }}
        </Suspense>
        <div data-testid="count">Count: {count.value}</div>
        <div>
          <button data-testid="increment" onClick={() => count.value++}>
            Increment
          </button>
        </div>
      </div>
    )
  },
})

export const Route = createFileRoute('/deferred')({
  loader: async () => {
    return {
      deferredStuff: new Promise<string>((r) =>
        setTimeout(() => r('Hello deferred!'), 2000),
      ),
      deferredPerson: slowServerFn({ data: { name: 'Tanner Linsley' } }),
      person: await personServerFn({ data: { name: 'John Doe' } }),
    }
  },
  component: Deferred,
})
