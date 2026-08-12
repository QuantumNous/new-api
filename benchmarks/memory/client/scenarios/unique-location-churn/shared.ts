import {
  createDeterministicRandom,
  randomSegment,
} from '#memory-client/bench-utils'
import {
  createBenchContainer,
  nextAnimationFrame,
  noop,
  removeBenchContainer,
  warnClientMemoryDevMode,
} from '#memory-client/lifecycle'
import type { Framework, MountTestApp } from '#memory-client/lifecycle'

type ItemLocation = {
  id: string
  q: string
}

type NavigationRouter = {
  load: () => Promise<void>
  navigate: (options: {
    to: '/items/$id'
    params: { id: string }
    search: { q: string }
    replace: true
  }) => Promise<void>
  subscribe: (event: 'onRendered', listener: () => void) => () => void
}

const uniqueLocationChurnIterations = 300
// Module-level so ids stay unique across runner invocations on one mount; the
// counter prefix removes any residual LCG birthday-collision risk.
const benchmarkRandom = createDeterministicRandom(0xdecafbad)
let locationCounter = 0

const uninitialized = () =>
  Promise.reject(
    new Error('unique-location-churn benchmark is not initialized'),
  )

export function createWorkload(
  framework: Framework,
  mountTestApp: MountTestApp,
) {
  warnClientMemoryDevMode(framework)

  let container: HTMLDivElement | undefined = undefined
  let unmount = noop
  let unsub = noop
  let resolveRendered: () => void = noop
  let navigateTo: (location: ItemLocation) => Promise<void> = uninitialized

  function assertRenderedId(expected: string) {
    const actual =
      container?.querySelector<HTMLElement>('[data-bench-id]')?.dataset.benchId

    if (actual !== expected) {
      throw new Error(`Expected rendered item id ${expected}, got ${actual}`)
    }
  }

  async function waitForRenderedId(expected: string) {
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        assertRenderedId(expected)
        return
      } catch {
        await nextAnimationFrame()
      }
    }

    assertRenderedId(expected)
  }

  function waitForNextRender() {
    return new Promise<void>((resolve) => {
      resolveRendered = resolve
    })
  }

  async function before() {
    if (container) {
      after()
    }

    container = createBenchContainer()

    const mounted = mountTestApp(container)
    const router = mounted.router as NavigationRouter
    unmount = mounted.unmount

    unsub = router.subscribe('onRendered', () => {
      resolveRendered()
    })

    navigateTo = async (location) => {
      const rendered = waitForNextRender()
      await Promise.all([
        router.navigate({
          to: '/items/$id',
          params: { id: location.id },
          search: { q: location.q },
          replace: true,
        }),
        rendered,
      ])
    }

    await router.load()
    await waitForRenderedId('initial')
  }

  function after() {
    unmount()
    removeBenchContainer(container)
    unsub()

    container = undefined
    unmount = noop
    unsub = noop
    resolveRendered = noop
    navigateTo = uninitialized
  }

  return {
    name: `mem unique-location-churn (${framework})`,
    before,
    navigate: (location: ItemLocation) => navigateTo(location),
    async run() {
      for (let index = 0; index < uniqueLocationChurnIterations; index++) {
        const id = `${(locationCounter++).toString(36)}-${randomSegment(benchmarkRandom)}`
        const q = `q-${randomSegment(benchmarkRandom)}`

        await navigateTo({ id, q })
      }
    },
    async sanity() {
      await before()

      try {
        await navigateTo({ id: 'sanity-one', q: 'q-sanity-one' })
        assertRenderedId('sanity-one')
      } finally {
        after()
      }
    },
    after,
  }
}
