import * as Solid from 'solid-js'

import { createFileRoute } from '@tanstack/solid-router'
import { Hydrate } from '@tanstack/solid-start'
import {
  condition,
  idle,
  interaction,
  load,
  media,
  never,
  visible,
} from '@tanstack/solid-start/hydration'

export const Route = createFileRoute('/components')({
  component: ComponentHydrationPage,
})

function InteractiveBox(props: { id: string; label: string }) {
  const [count, setCount] = Solid.createSignal(0)
  const [hydrated, setHydrated] = Solid.createSignal(false)

  Solid.onMount(() => {
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

function DelayedFallbackBox() {
  if (typeof window !== 'undefined') {
    const [ready] = Solid.createResource(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 1000))
      return true
    })

    return (
      <Solid.Show when={ready()}>
        <div data-testid="component-fallback-child">fallback child</div>
      </Solid.Show>
    )
  }

  return <div data-testid="component-fallback-child">fallback child</div>
}

function ComponentHydrationPage() {
  const [hydratedCallbacks, setHydratedCallbacks] = Solid.createSignal(0)
  const [conditionReady, setConditionReady] = Solid.createSignal(false)
  const [showClientFallbackBoundary, setShowClientFallbackBoundary] =
    Solid.createSignal(false)

  return (
    <section>
      <h1 data-testid="component-heading">Component Deferred Hydration</h1>
      <div class="dh-guide">
        <strong>Manual test guide</strong>
        <span>
          Pink buttons are server HTML that has not hydrated yet. Green buttons
          have hydrated and should increment when clicked. Follow the notes
          below to trigger each strategy intentionally.
        </span>
      </div>
      <p data-testid="component-on-hydrated-count">{hydratedCallbacks()}</p>
      <p class="dh-note">
        <strong>load</strong> and <strong>idle</strong> should become green
        without interaction shortly after the page loads.
      </p>
      <Hydrate when={load()} split={false}>
        <InteractiveBox id="component-load" label="load" />
      </Hydrate>
      <Hydrate when={idle({ timeout: 10 })} split={false}>
        <InteractiveBox id="component-idle" label="idle" />
      </Hydrate>
      <div class="dh-spacer">Scroll down to reveal the visible boundary</div>
      <p class="dh-note">
        <strong>visible</strong> hydrates only after this button enters the
        viewport.
      </p>
      <Hydrate when={visible({ rootMargin: '0px' })}>
        <InteractiveBox id="component-visible" label="visible" />
      </Hydrate>
      <p class="dh-note">
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
      <p class="dh-note">
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
      <p class="dh-note">
        <strong>never</strong> stays as server HTML forever on the initial page,
        so clicking should not increment it.
      </p>
      <button
        data-testid="component-show-client-fallback"
        onClick={() => setShowClientFallbackBoundary(true)}
      >
        show client fallback
      </button>
      <Solid.Show when={showClientFallbackBoundary()}>
        <Hydrate
          when={load()}
          fallback={
            <div data-testid="component-client-fallback">client fallback</div>
          }
        >
          <DelayedFallbackBox />
        </Hydrate>
      </Solid.Show>
    </section>
  )
}
