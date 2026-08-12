import {
  createBenchContainer,
  drainMicrotasks,
  noop,
  removeBenchContainer,
  warnClientMemoryDevMode,
} from '#memory-client/lifecycle'
import type { Framework, MountTestApp } from '#memory-client/lifecycle'

type RenderRouter = {
  load: () => Promise<void>
  subscribe: (event: 'onRendered', listener: () => void) => () => void
}

const mountUnmountIterations = 100

function assertEmptyBody() {
  if (document.body.childNodes.length !== 0) {
    throw new Error(
      `Expected document.body to be empty, found ${document.body.childNodes.length} child node(s)`,
    )
  }
}

export function createWorkload(
  framework: Framework,
  mountTestApp: MountTestApp,
) {
  warnClientMemoryDevMode(framework)

  async function cycle() {
    const container = createBenchContainer()

    let unmount = noop
    let unsubscribe = noop

    try {
      const mounted = mountTestApp(container)
      const router = mounted.router as RenderRouter
      unmount = mounted.unmount

      const rendered = new Promise<void>((resolve) => {
        unsubscribe = router.subscribe('onRendered', () => {
          resolve()
        })
      })

      await router.load()
      await rendered
      unsubscribe()
      unsubscribe = noop
    } finally {
      unmount()
      removeBenchContainer(container)
      unsubscribe()
      await drainMicrotasks()
    }
  }

  return {
    name: `mem mount-unmount (${framework})`,
    cycle,
    async run() {
      for (let index = 0; index < mountUnmountIterations; index++) {
        await cycle()
      }
    },
    async sanity() {
      assertEmptyBody()
      await cycle()
      assertEmptyBody()
    },
  }
}
