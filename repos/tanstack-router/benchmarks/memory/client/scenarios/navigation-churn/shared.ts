import {
  createBenchContainer,
  nextAnimationFrame,
  noop,
  removeBenchContainer,
  warnClientMemoryDevMode,
} from '#memory-client/lifecycle'
import type { Framework, MountTestApp } from '#memory-client/lifecycle'

type Target = '/a' | '/b'

type NavigationRouter = {
  load: () => Promise<void>
  navigate: (options: { to: Target; replace: true }) => Promise<void>
  subscribe: (event: 'onRendered', listener: () => void) => () => void
}

const navigationChurnIterations = 300

const uninitialized = () =>
  Promise.reject(new Error('navigation-churn benchmark is not initialized'))

export function createWorkload(
  framework: Framework,
  mountTestApp: MountTestApp,
) {
  warnClientMemoryDevMode(framework)

  let container: HTMLDivElement | undefined = undefined
  let unmount = noop
  let unsub = noop
  let resolveRendered: () => void = noop
  let navigateTo: (target: Target) => Promise<void> = uninitialized

  function assertRenderedPage(target: Target) {
    const expected = target.slice(1)
    const actual =
      container?.querySelector<HTMLElement>('[data-bench-page]')?.dataset
        .benchPage

    if (actual !== expected) {
      throw new Error(`Expected rendered page ${expected}, got ${actual}`)
    }
  }

  async function waitForRenderedPage(target: Target) {
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        assertRenderedPage(target)
        return
      } catch {
        await nextAnimationFrame()
      }
    }

    assertRenderedPage(target)
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

    navigateTo = async (target) => {
      const rendered = waitForNextRender()
      await Promise.all([
        router.navigate({
          to: target,
          replace: true,
        }),
        rendered,
      ])
    }

    await router.load()
    await waitForRenderedPage('/a')
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
    name: `mem client navigation-churn (${framework})`,
    before,
    navigate: (target: Target) => navigateTo(target),
    async run() {
      for (let index = 0; index < navigationChurnIterations; index++) {
        await navigateTo(index % 2 === 0 ? '/b' : '/a')
      }
    },
    async sanity() {
      await before()

      try {
        assertRenderedPage('/a')
        await navigateTo('/b')
        assertRenderedPage('/b')
      } finally {
        after()
      }
    },
    after,
  }
}
