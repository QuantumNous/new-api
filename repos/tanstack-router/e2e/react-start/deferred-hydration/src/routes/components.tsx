import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'
import { Hydrate } from '@tanstack/react-start'
import {
  condition,
  idle,
  interaction,
  load,
  media,
  never,
  visible,
} from '@tanstack/react-start/hydration'

export const Route = createFileRoute('/components')({
  component: ComponentHydrationPage,
})

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

type HydrationFallbackWindow = Window & {
  __componentFallbackReady?: boolean
  __componentFallbackPromise?: Promise<void>
}

function DelayedFallbackBox() {
  if (typeof window !== 'undefined') {
    const win = window as HydrationFallbackWindow

    if (!win.__componentFallbackReady) {
      win.__componentFallbackPromise ??= new Promise<void>((resolve) => {
        win.setTimeout(() => {
          win.__componentFallbackReady = true
          resolve()
        }, 1000)
      })

      throw win.__componentFallbackPromise
    }
  }

  return <div data-testid="component-fallback-child">fallback child</div>
}

function ComponentHydrationPage() {
  const [hydratedCallbacks, setHydratedCallbacks] = React.useState(0)
  const [conditionReady, setConditionReady] = React.useState(false)
  const [showClientFallbackBoundary, setShowClientFallbackBoundary] =
    React.useState(false)

  return (
    <section>
      <h1 data-testid="component-heading">Component Deferred Hydration</h1>
      <div className="dh-guide">
        <strong>Manual test guide</strong>
        <span>
          Pink buttons are server HTML that has not hydrated yet. Green buttons
          have hydrated and should increment when clicked. Follow the notes
          below to trigger each strategy intentionally.
        </span>
      </div>
      <p data-testid="component-on-hydrated-count">{hydratedCallbacks}</p>
      <p className="dh-note">
        <strong>load</strong> and <strong>idle</strong> should become green
        without interaction shortly after the page loads.
      </p>
      <Hydrate when={load()} split={false}>
        <InteractiveBox id="component-load" label="load" />
      </Hydrate>
      <Hydrate when={idle({ timeout: 10 })} split={false}>
        <InteractiveBox id="component-idle" label="idle" />
      </Hydrate>
      <div className="dh-spacer">
        Scroll down to reveal the visible boundary
      </div>
      <p className="dh-note">
        <strong>visible</strong> hydrates only after this button enters the
        viewport.
      </p>
      <Hydrate when={visible({ rootMargin: '0px' })}>
        <InteractiveBox id="component-visible" label="visible" />
      </Hydrate>
      <p className="dh-note">
        <strong>media</strong> hydrates when <code>(min-width: 1px)</code>
        matches. <strong>interaction</strong> hydrates on hover, focus, pointer
        down, or click intent.
      </p>
      <Hydrate when={media('(min-width: 1px)')} split={false}>
        <InteractiveBox id="component-media" label="media" />
      </Hydrate>
      <Hydrate when={interaction()} split={false}>
        <InteractiveBox id="component-interaction" label="interaction" />
      </Hydrate>
      <p className="dh-note">
        Custom interaction boundaries below hydrate only for their configured
        events: double-click for the single-event example, and right-click or
        double-click for the multi-event example. The prefetch example should
        download code on hover but hydrate on click.
      </p>
      <Hydrate
        when={interaction({ events: 'dblclick' })}
        onHydrated={() => setHydratedCallbacks((count) => count + 1)}
      >
        <InteractiveBox
          id="component-custom-single"
          label="double-click hydrates"
        />
      </Hydrate>
      <Hydrate when={interaction({ events: ['contextmenu', 'dblclick'] })}>
        <InteractiveBox
          id="component-custom-multi"
          label="right-click or double-click hydrates"
        />
      </Hydrate>
      <button
        data-testid="component-enable-condition"
        onClick={() => setConditionReady(true)}
      >
        enable condition
      </button>
      <Hydrate when={condition(conditionReady)}>
        <InteractiveBox id="component-condition" label="condition" />
      </Hydrate>
      <Hydrate when={interaction({ events: 'click' })}>
        <InteractiveBox id="component-click-replay" label="click replay" />
      </Hydrate>
      <Hydrate
        when={interaction({ events: 'click' })}
        prefetch={interaction({ events: 'pointerover' })}
      >
        <InteractiveBox id="component-prefetch" label="prefetch" />
      </Hydrate>
      <Hydrate when={media('(max-width: 1px)')}>
        <Hydrate when={interaction()}>
          <InteractiveBox id="component-nested-child" label="nested child" />
        </Hydrate>
      </Hydrate>
      <Hydrate when={never()} split={false}>
        <InteractiveBox id="component-never" label="never" />
      </Hydrate>
      <p className="dh-note">
        <strong>never</strong> stays as server HTML forever on the initial page,
        so clicking should not increment it.
      </p>
      <button
        data-testid="component-show-client-fallback"
        onClick={() => setShowClientFallbackBoundary(true)}
      >
        show client fallback
      </button>
      {showClientFallbackBoundary ? (
        <Hydrate
          when={load()}
          fallback={
            <div data-testid="component-client-fallback">client fallback</div>
          }
        >
          <DelayedFallbackBox />
        </Hydrate>
      ) : null}
    </section>
  )
}
