import { getRequiredLink, waitForRequiredLink } from '../setup-helpers'

export interface ScenarioRouter {
  load: () => Promise<void>
  subscribe: (eventType: 'onRendered', callback: () => void) => () => void
  navigate: (options: any) => Promise<void>
  preloadRoute: (options: any) => Promise<any>
  invalidate: () => Promise<void>
  history: {
    back: () => void
    forward: () => void
    go: (index: number) => void
  }
}

export interface MountedScenarioApp {
  router: ScenarioRouter
  unmount: () => void
}

/**
 * A single benchmark step. Plain strings are link-click steps (the common
 * case). Steps that change the router location (`click`, `navigate`, `back`,
 * `forward`, `go`) are awaited through the router's `onRendered` event; steps
 * that do background work (`hover`, `preload`, `invalidate`) are awaited
 * through a fixed number of 0ms timer hops so the loop stays deterministic.
 */
export type ScenarioStep =
  | string
  | {
      type: 'click'
      testId: string
      /**
       * Optional post-render settle predicate for steps that trigger work
       * finishing after `onRendered` (e.g. deferred data resolving through a
       * Suspense boundary). The step keeps taking 0ms timer hops until the
       * predicate returns true (bounded, throws when exceeded).
       */
      isSettled?: () => boolean
    }
  | {
      /**
       * Dispatches a single `mouseover` on the link, which triggers
       * `preload: 'intent'` exactly once in every adapter: React synthesizes
       * `mouseEnter` from `mouseover`, and Solid/Vue attach a native
       * `mouseover` preload handler. (Solid/Vue also listen to `mouseenter` —
       * dispatching both events would run the preload pipeline twice for them
       * but only once for React.) Then settles via counted 0ms hops.
       */
      type: 'hover'
      testId: string
      settleHops?: number
    }
  | { type: 'navigate'; getOptions: () => object }
  | { type: 'preload'; getOptions: () => object; settleHops?: number }
  | { type: 'invalidate'; settleHops?: number }
  | { type: 'back' }
  | { type: 'forward' }
  | { type: 'go'; delta: number }

/**
 * One macrotask turn via `setImmediate` rather than `setTimeout(0)`: both
 * yield deterministically to the event loop (timers, MessageChannel, React's
 * Node scheduler), but a timer costs ~3-4 syscalls (timerfd + epoll) per hop
 * while an immediate costs ~1. CodSpeed excludes syscall time from the
 * measure — inconsistently past a threshold, which flagged the hop-heavy
 * benches as "skipped" — so the loop must stay syscall-lean.
 */
const timerHop = () =>
  new Promise<void>((resolve) => setImmediate(() => resolve()))

async function settle(hops: number) {
  for (let i = 0; i < hops; i++) {
    await timerHop()
  }
}

const MAX_SETTLE_HOPS = 100

async function settleUntil(isSettled: () => boolean, label: string) {
  for (let i = 0; i < MAX_SETTLE_HOPS; i++) {
    if (isSettled()) {
      return
    }
    await timerHop()
  }
  throw new Error(
    `Step "${label}" did not settle within ${MAX_SETTLE_HOPS} timer hops`,
  )
}

/**
 * Reroute zero-delay `window.setTimeout` calls onto `setImmediate` for the
 * duration of the benchmark. jsdom delivers history traversals through two
 * nested `window.setTimeout(0)` tasks; Node clamps those to 1ms of wall
 * time, so with nothing else pending the event loop blocks in `epoll_wait`
 * until each timer expires — and that blocked wall-time is recorded as
 * highly variable syscall time (5-26ms across runs), enough for CodSpeed to
 * skip-warn the history benches. Zero-delay timeouts carry no ordering
 * semantics a check-phase immediate doesn't satisfy, and the suite's
 * conventions already forbid real-delay timers in measured code; non-zero
 * delays are passed through untouched.
 */
function patchZeroDelayTimeouts() {
  const originalSetTimeout = window.setTimeout.bind(window)
  const originalClearTimeout = window.clearTimeout.bind(window)
  const immediates = new Map<number, NodeJS.Immediate>()
  // Negative ids cannot collide with real jsdom timer ids.
  let nextImmediateId = -2

  window.setTimeout = ((
    handler: (...handlerArgs: Array<any>) => void,
    delay?: number,
    ...args: Array<any>
  ) => {
    if (!delay) {
      const id = nextImmediateId--
      immediates.set(
        id,
        setImmediate(() => {
          immediates.delete(id)
          handler(...args)
        }),
      )
      return id
    }
    return originalSetTimeout(handler, delay, ...args)
  }) as typeof window.setTimeout

  window.clearTimeout = ((id: number) => {
    const immediate = immediates.get(id)
    if (immediate) {
      clearImmediate(immediate)
      immediates.delete(id)
      return
    }
    originalClearTimeout(id)
  }) as typeof window.clearTimeout

  return () => {
    window.setTimeout = originalSetTimeout as typeof window.setTimeout
    window.clearTimeout = originalClearTimeout as typeof window.clearTimeout
  }
}

export interface ScenarioSetupOptions {
  frameworkLabel: string
  mount: (container: HTMLElement) => MountedScenarioApp
  /**
   * Circular sequence of steps advanced by `tick()`. Link steps must target
   * links rendered from the start (e.g. in the root layout), no two
   * consecutive location-changing steps may target the same location (a
   * same-location click never triggers `onRendered`), and the sequence must
   * leave the app back on the initial route so the warm-up lap ends in the
   * starting state.
   */
  steps: ReadonlyArray<ScenarioStep>
  /** Sanity check run once per step during the warm-up lap in `before()`. */
  assertAfterStep?: (stepIndex: number, container: HTMLElement) => void
  /**
   * URL the window is reset to before mounting (default '/'). Scenarios whose
   * router uses a `basepath` or an input rewrite must start on an external
   * URL that maps to their initial route.
   */
  initialUrl?: string
}

function warnAboutDevMode(frameworkLabel: string) {
  if (process.env.NODE_ENV !== 'production') {
    console.warn(
      `client-nav scenario benchmark is running without NODE_ENV=production; ${frameworkLabel} dev overhead will dominate results.`,
    )
  }
}

/**
 * Shared scenario runner: mounts the prebuilt app, then advances a circular
 * sequence of steps, synchronizing each step so its work is fully part of the
 * measured tick and steps cannot overlap.
 */
export function createScenarioSetup(options: ScenarioSetupOptions) {
  warnAboutDevMode(options.frameworkLabel)

  let container: HTMLDivElement | undefined = undefined
  let unmount: (() => void) | undefined = undefined
  let unsub = () => {}
  let restoreTimeouts = () => {}
  let stepIndex = 0
  let next: () => Promise<void> = () =>
    Promise.reject(new Error('Benchmark not initialized'))

  async function before() {
    stepIndex = 0
    restoreTimeouts = patchZeroDelayTimeouts()
    window.history.replaceState(null, '', options.initialUrl ?? '/')
    container = document.createElement('div')
    document.body.append(container)

    const { router, unmount: dispose } = options.mount(container)
    unmount = dispose

    let resolveRendered: () => void = () => {}
    unsub = router.subscribe('onRendered', () => {
      resolveRendered()
    })

    const cachedLinks = new Map<string, HTMLAnchorElement>()
    const rendered = () =>
      new Promise<void>((resolveNext) => {
        resolveRendered = resolveNext
      })

    const runStep = async (step: ScenarioStep) => {
      if (typeof step === 'string') {
        step = { type: 'click', testId: step }
      }

      switch (step.type) {
        case 'click': {
          const renderedPromise = rendered()
          getRequiredLink(container!, step.testId, cachedLinks).dispatchEvent(
            new MouseEvent('click', {
              bubbles: true,
              cancelable: true,
              button: 0,
            }),
          )
          await renderedPromise
          if (step.isSettled) {
            await settleUntil(step.isSettled, `click ${step.testId}`)
          }
          return
        }
        case 'hover': {
          const link = getRequiredLink(container!, step.testId, cachedLinks)
          link.dispatchEvent(
            new MouseEvent('mouseover', { bubbles: true, cancelable: true }),
          )
          await settle(step.settleHops ?? 4)
          return
        }
        case 'navigate': {
          const renderedPromise = rendered()
          router.navigate(step.getOptions())
          await renderedPromise
          return
        }
        case 'preload': {
          await router.preloadRoute(step.getOptions())
          await settle(step.settleHops ?? 2)
          return
        }
        case 'invalidate': {
          await router.invalidate()
          await settle(step.settleHops ?? 2)
          return
        }
        case 'back': {
          const renderedPromise = rendered()
          router.history.back()
          await renderedPromise
          return
        }
        case 'forward': {
          const renderedPromise = rendered()
          router.history.forward()
          await renderedPromise
          return
        }
        case 'go': {
          const renderedPromise = rendered()
          router.history.go(step.delta)
          await renderedPromise
          return
        }
      }
    }

    await router.load()

    const linkTestIds = new Set<string>()
    for (const step of options.steps) {
      if (typeof step === 'string') {
        linkTestIds.add(step)
      } else if (step.type === 'click' || step.type === 'hover') {
        linkTestIds.add(step.testId)
      }
    }
    for (const testId of linkTestIds) {
      await waitForRequiredLink(container, testId, cachedLinks)
    }

    // One warm-up lap that also sanity-checks each step's observable output,
    // ending back on the initial route so measurement starts from a known state.
    for (const [index, step] of options.steps.entries()) {
      await runStep(step)
      options.assertAfterStep?.(index, container)
    }

    next = () => {
      const step = options.steps[stepIndex % options.steps.length]!
      stepIndex += 1
      return runStep(step)
    }
  }

  function after() {
    unmount?.()
    container?.remove()
    unsub()
    restoreTimeouts()
    restoreTimeouts = () => {}
    unmount = undefined
    container = undefined
  }

  function tick() {
    return next()
  }

  return {
    before,
    tick,
    after,
  }
}

export interface MountLoopSetupOptions {
  frameworkLabel: string
  mount: (container: HTMLElement) => MountedScenarioApp
  /** Test id that must appear in the container before a mount counts as done. */
  readyTestId: string
  assertReady?: (container: HTMLElement) => void
}

/**
 * Mount-loop runner for cold-start scenarios: every tick creates a fresh
 * container, mounts the app (router creation included), waits for the initial
 * render to commit, then unmounts and cleans up.
 */
export function createMountLoopSetup(options: MountLoopSetupOptions) {
  warnAboutDevMode(options.frameworkLabel)

  async function tick() {
    window.history.replaceState(null, '', '/')
    const container = document.createElement('div')
    document.body.append(container)

    const { router, unmount } = options.mount(container)

    try {
      await router.load()
      await settleUntil(
        () =>
          container.querySelector(`[data-testid="${options.readyTestId}"]`) !==
          null,
        `mount ${options.readyTestId}`,
      )
      options.assertReady?.(container)
    } finally {
      unmount()
      container.remove()
    }
  }

  return {
    before: async () => {},
    tick,
    after: () => {},
  }
}
