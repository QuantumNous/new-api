import { Show, createSignal, onMount, type JSX } from 'solid-js'
import { createFileRoute } from '@tanstack/solid-router'
import { Hydrate } from '@tanstack/solid-start'
import { interaction, media } from '@tanstack/solid-start/hydration'
import { EnhancedNestedWidget } from '../shared/EnhancedNestedWidget'

type EnhancedSearch = {
  dynamic?: 'interaction'
}

export const Route = createFileRoute('/enhanced')({
  validateSearch: (search: Record<string, unknown>): EnhancedSearch => ({
    dynamic: search.dynamic === 'interaction' ? 'interaction' : undefined,
  }),
  component: EnhancedHydrationPage,
})

type DeferredGate = {
  promise: Promise<void>
  resolve: () => void
}

const clickIntent = interaction({ events: 'click' })
const pointerOverIntent = interaction({ events: 'pointerover' })
const doubleClickIntent = interaction({ events: 'dblclick' })

function createDeferredGate(): DeferredGate {
  let resolve!: () => void
  const promise = new Promise<void>((next) => {
    resolve = next
  })
  return { promise, resolve }
}

function InteractiveBox(props: { id: string; label: string }): JSX.Element {
  const [count, setCount] = createSignal(0)
  const [hydrated, setHydrated] = createSignal(false)

  onMount(() => {
    setHydrated(true)
  })

  return (
    <button
      data-testid={`${props.id}-button`}
      data-hydrated={hydrated() ? 'true' : 'false'}
      onClick={() => setCount((prev) => prev + 1)}
    >
      {props.label}: <span data-testid={`${props.id}-count`}>{count()}</span>
    </button>
  )
}

function DynamicWhenExamples(): JSX.Element {
  const search = Route.useSearch()
  const searchDrivenHydration = () =>
    search().dynamic === 'interaction' ? clickIntent : doubleClickIntent

  return (
    <>
      <p class="dh-note">
        Dynamic callbacks are client-only. The first boundary always hydrates on
        click; the second reads typed router search state before choosing its
        interaction event.
      </p>
      <Hydrate when={() => clickIntent}>
        <InteractiveBox
          id="enhanced-dynamic-interaction"
          label="dynamic interaction"
        />
      </Hydrate>
      <Hydrate when={searchDrivenHydration}>
        <InteractiveBox
          id="enhanced-dynamic-conditional"
          label="conditional dynamic"
        />
      </Hydrate>
    </>
  )
}

function SplitPrefetchExample(): JSX.Element {
  const gate = createDeferredGate()
  const [waitReason, setWaitReason] = createSignal('idle')
  const [preloadStatus, setPreloadStatus] = createSignal('idle')
  const [queryStatus, setQueryStatus] = createSignal('idle')

  return (
    <>
      <p data-testid="enhanced-split-wait-reason">{waitReason()}</p>
      <p data-testid="enhanced-split-preload">{preloadStatus()}</p>
      <p data-testid="enhanced-split-query">{queryStatus()}</p>
      <button
        data-testid="enhanced-release-split-prefetch"
        onClick={() => gate.resolve()}
      >
        release split prefetch
      </button>
      <Hydrate
        when={clickIntent}
        prefetch={async ({ waitFor, preload, signal, element }) => {
          setQueryStatus(element ? 'element' : 'missing-element')
          setWaitReason('waiting')

          const reason = await waitFor(pointerOverIntent)
          setWaitReason(reason)
          if (reason === 'abort' || signal.aborted) return

          await preload()
          setPreloadStatus('done')
          await gate.promise
          setQueryStatus('done')
        }}
      >
        <InteractiveBox
          id="enhanced-procedural-split"
          label="procedural split enhanced-procedural-split-child"
        />
      </Hydrate>
    </>
  )
}

function FireAndForgetPrefetchExample(): JSX.Element {
  const gate = createDeferredGate()
  const [waitReason, setWaitReason] = createSignal('idle')
  const [workStatus, setWorkStatus] = createSignal('idle')
  const [queryStatus, setQueryStatus] = createSignal('idle')

  return (
    <>
      <p data-testid="enhanced-fire-status">{workStatus()}</p>
      <p data-testid="enhanced-fire-wait-reason">{waitReason()}</p>
      <p data-testid="enhanced-fire-query">{queryStatus()}</p>
      <button
        data-testid="enhanced-release-fire-prefetch"
        onClick={() => gate.resolve()}
      >
        release fire-and-forget prefetch
      </button>
      <Hydrate
        when={clickIntent}
        prefetch={({ waitFor }) => {
          setWaitReason('waiting')
          void waitFor(pointerOverIntent).then((reason) => {
            setWaitReason(reason)
            if (reason === 'abort') return

            setWorkStatus('started')
            void gate.promise.then(() => {
              setQueryStatus('done')
            })
          })
        }}
      >
        <InteractiveBox
          id="enhanced-fire-and-forget"
          label="fire and forget enhanced-fire-and-forget-child"
        />
      </Hydrate>
    </>
  )
}

function HydrateFirstPrefetchExample(): JSX.Element {
  const [reason, setReason] = createSignal('idle')

  return (
    <>
      <p data-testid="enhanced-hydrate-first-reason">{reason()}</p>
      <Hydrate
        when={clickIntent}
        prefetch={async ({ waitFor }) => {
          setReason(await waitFor(doubleClickIntent))
        }}
      >
        <InteractiveBox id="enhanced-hydrate-first" label="hydrate first" />
      </Hydrate>
    </>
  )
}

function RuntimeOnlyPrefetchExample(): JSX.Element {
  const gate = createDeferredGate()
  const [waitReason, setWaitReason] = createSignal('idle')
  const [runtimeStatus, setRuntimeStatus] = createSignal('idle')

  return (
    <>
      <p data-testid="enhanced-runtime-wait-reason">{waitReason()}</p>
      <p data-testid="enhanced-runtime-status">{runtimeStatus()}</p>
      <button
        data-testid="enhanced-release-runtime-prefetch"
        onClick={() => gate.resolve()}
      >
        release runtime-only prefetch
      </button>
      <Hydrate
        when={clickIntent}
        split={false}
        prefetch={async ({ waitFor, preload }) => {
          setWaitReason('waiting')
          const reason = await waitFor(pointerOverIntent)
          setWaitReason(reason)
          if (reason === 'abort') return

          await gate.promise
          await preload()
          setRuntimeStatus('ready')
        }}
      >
        <InteractiveBox
          id="enhanced-runtime-only"
          label="runtime only enhanced-runtime-only-child"
        />
      </Hydrate>
    </>
  )
}

function WaitForAbortExample(): JSX.Element {
  const [showBoundary, setShowBoundary] = createSignal(true)
  const [reason, setReason] = createSignal('idle')

  return (
    <>
      <p data-testid="enhanced-wait-abort-reason">{reason()}</p>
      <button
        data-testid="enhanced-hide-wait-abort"
        onClick={() => setShowBoundary(false)}
      >
        hide waitFor abort boundary
      </button>
      <Show when={showBoundary()}>
        <Hydrate
          when={clickIntent}
          prefetch={async ({ waitFor }) => {
            setReason('waiting')
            setReason(await waitFor(pointerOverIntent))
          }}
        >
          <InteractiveBox id="enhanced-wait-abort" label="wait abort" />
        </Hydrate>
      </Show>
    </>
  )
}

function SignalAbortExample(): JSX.Element {
  const [showBoundary, setShowBoundary] = createSignal(true)
  const [status, setStatus] = createSignal('idle')

  return (
    <>
      <p data-testid="enhanced-abort-status">{status()}</p>
      <button
        data-testid="enhanced-hide-abort"
        onClick={() => setShowBoundary(false)}
      >
        hide abort boundary
      </button>
      <Show when={showBoundary()}>
        <Hydrate
          when={clickIntent}
          prefetch={async ({ signal }) => {
            setStatus('listening')
            await new Promise<void>((resolve) => {
              const onAbort = () => {
                setStatus('aborted')
                resolve()
              }

              if (signal.aborted) {
                onAbort()
                return
              }

              signal.addEventListener('abort', onAbort, { once: true })
            })
          }}
        >
          <InteractiveBox id="enhanced-abort" label="abort" />
        </Hydrate>
      </Show>
    </>
  )
}

function NestedDynamicExamples(): JSX.Element {
  return (
    <>
      <Hydrate when={media('(max-width: 1px)')}>
        <Hydrate when={() => clickIntent}>
          <InteractiveBox id="enhanced-dynamic-nested" label="dynamic nested" />
        </Hydrate>
      </Hydrate>
      <EnhancedNestedWidget />
    </>
  )
}

function EnhancedHydrationPage(): JSX.Element {
  return (
    <section>
      <h1 data-testid="enhanced-heading">Enhanced Hydrate APIs</h1>
      <DynamicWhenExamples />
      <SplitPrefetchExample />
      <FireAndForgetPrefetchExample />
      <HydrateFirstPrefetchExample />
      <RuntimeOnlyPrefetchExample />
      <WaitForAbortExample />
      <SignalAbortExample />
      <NestedDynamicExamples />
    </section>
  )
}
