import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'
import { Hydrate } from '@tanstack/react-start'
import { interaction, media } from '@tanstack/react-start/hydration'
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

function useDeferredGate() {
  const ref = React.useRef<DeferredGate | undefined>(undefined)
  ref.current ??= createDeferredGate()
  return ref.current
}

function mergeStatus<T extends Record<string, string>>(
  setStatus: React.Dispatch<React.SetStateAction<T>>,
  patch: Partial<T>,
) {
  setStatus((current) => ({ ...current, ...patch }))
}

function InteractiveBox(props: { id: string; label: string }) {
  const [count, setCount] = React.useState(0)
  const [hydrated, setHydrated] = React.useState(false)

  React.useEffect(() => {
    setHydrated(true)
  }, [])

  return (
    <button
      data-testid={`${props.id}-button`}
      data-hydrated={hydrated ? 'true' : 'false'}
      onClick={() => setCount((prev) => prev + 1)}
    >
      {props.label}: <span data-testid={`${props.id}-count`}>{count}</span>
    </button>
  )
}

function DynamicWhenExamples() {
  const search = Route.useSearch()
  const searchDrivenHydration = React.useCallback(
    () => (search.dynamic === 'interaction' ? clickIntent : doubleClickIntent),
    [search.dynamic],
  )

  return (
    <>
      <p className="dh-note">
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

function SplitPrefetchExample() {
  const gate = useDeferredGate()
  const [status, setStatus] = React.useState({
    wait: 'idle',
    preload: 'idle',
    query: 'idle',
  })

  return (
    <>
      <p data-testid="enhanced-split-wait-reason">{status.wait}</p>
      <p data-testid="enhanced-split-preload">{status.preload}</p>
      <p data-testid="enhanced-split-query">{status.query}</p>
      <button
        data-testid="enhanced-release-split-prefetch"
        onClick={() => gate.resolve()}
      >
        release split prefetch
      </button>
      <Hydrate
        when={clickIntent}
        prefetch={async ({ waitFor, preload, signal, element }) => {
          mergeStatus(setStatus, {
            query: element ? 'element' : 'missing-element',
            wait: 'waiting',
          })

          const reason = await waitFor(pointerOverIntent)
          mergeStatus(setStatus, { wait: reason })
          if (reason === 'abort' || signal.aborted) return

          await preload()
          mergeStatus(setStatus, { preload: 'done' })
          await gate.promise
          mergeStatus(setStatus, { query: 'done' })
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

function FireAndForgetPrefetchExample() {
  const gate = useDeferredGate()
  const [status, setStatus] = React.useState({
    wait: 'idle',
    work: 'idle',
    query: 'idle',
  })

  return (
    <>
      <p data-testid="enhanced-fire-status">{status.work}</p>
      <p data-testid="enhanced-fire-wait-reason">{status.wait}</p>
      <p data-testid="enhanced-fire-query">{status.query}</p>
      <button
        data-testid="enhanced-release-fire-prefetch"
        onClick={() => gate.resolve()}
      >
        release fire-and-forget prefetch
      </button>
      <Hydrate
        when={clickIntent}
        prefetch={({ waitFor }) => {
          mergeStatus(setStatus, { wait: 'waiting' })
          void waitFor(pointerOverIntent).then((reason) => {
            mergeStatus(setStatus, { wait: reason })
            if (reason === 'abort') return

            mergeStatus(setStatus, { work: 'started' })
            void gate.promise.then(() => {
              mergeStatus(setStatus, { query: 'done' })
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

function HydrateFirstPrefetchExample() {
  const [reason, setReason] = React.useState('idle')

  return (
    <>
      <p data-testid="enhanced-hydrate-first-reason">{reason}</p>
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

function RuntimeOnlyPrefetchExample() {
  const gate = useDeferredGate()
  const [status, setStatus] = React.useState({
    wait: 'idle',
    ready: 'idle',
  })

  return (
    <>
      <p data-testid="enhanced-runtime-wait-reason">{status.wait}</p>
      <p data-testid="enhanced-runtime-status">{status.ready}</p>
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
          mergeStatus(setStatus, { wait: 'waiting' })
          const reason = await waitFor(pointerOverIntent)
          mergeStatus(setStatus, { wait: reason })
          if (reason === 'abort') return

          await gate.promise
          await preload()
          mergeStatus(setStatus, { ready: 'ready' })
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

function WaitForAbortExample() {
  const [showBoundary, setShowBoundary] = React.useState(true)
  const [reason, setReason] = React.useState('idle')

  return (
    <>
      <p data-testid="enhanced-wait-abort-reason">{reason}</p>
      <button
        data-testid="enhanced-hide-wait-abort"
        onClick={() => setShowBoundary(false)}
      >
        hide waitFor abort boundary
      </button>
      {showBoundary ? (
        <Hydrate
          when={clickIntent}
          prefetch={async ({ waitFor }) => {
            setReason('waiting')
            setReason(await waitFor(pointerOverIntent))
          }}
        >
          <InteractiveBox id="enhanced-wait-abort" label="wait abort" />
        </Hydrate>
      ) : null}
    </>
  )
}

function SignalAbortExample() {
  const [showBoundary, setShowBoundary] = React.useState(true)
  const [status, setStatus] = React.useState('idle')

  return (
    <>
      <p data-testid="enhanced-abort-status">{status}</p>
      <button
        data-testid="enhanced-hide-abort"
        onClick={() => setShowBoundary(false)}
      >
        hide abort boundary
      </button>
      {showBoundary ? (
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
      ) : null}
    </>
  )
}

function NestedDynamicExamples() {
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

function EnhancedHydrationPage() {
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
