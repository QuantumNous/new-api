'use client'

import * as React from 'react'
import { Hydrate } from '@tanstack/react-start'
import { interaction, media, visible } from '@tanstack/react-start/hydration'

type Strategy = 'interaction' | 'visible' | 'media'

const strategyCopy: Record<Strategy, string> = {
  interaction: 'Hydrates after pointer or focus intent reaches this island.',
  visible: 'Hydrates only after the island scrolls into the viewport.',
  media: 'Hydrates immediately when the matching media query is true.',
}

function getStrategy(strategy: Strategy) {
  if (strategy === 'interaction') return interaction()
  if (strategy === 'visible') return visible({ rootMargin: '0px' })
  return media('(min-width: 1px)')
}

export function CounterButton(props: { id: string; label: string }) {
  const [count, setCount] = React.useState(0)
  const [hydrated, setHydrated] = React.useState(false)

  React.useEffect(() => {
    setHydrated(true)
  }, [])

  return (
    <button
      data-testid={`${props.id}-button`}
      data-hydrated={hydrated ? 'true' : 'false'}
      style={{
        background: hydrated ? '#059669' : '#db2777',
        boxShadow: hydrated
          ? '0 10px 30px rgba(5, 150, 105, 0.28)'
          : '0 10px 30px rgba(219, 39, 119, 0.25)',
        transition: 'background 180ms ease, box-shadow 180ms ease',
      }}
      onClick={() => setCount((prev) => prev + 1)}
    >
      {hydrated ? 'Hydrated' : 'Waiting'} {props.label}:{' '}
      <span data-testid={`${props.id}-count`}>{count}</span>
    </button>
  )
}

export function DeferredHydrateIsland(props: {
  id: string
  title: string
  strategy: Strategy
  className?: string
}) {
  return (
    <div
      data-testid={`${props.id}-island`}
      className={`strategy-card client-frame ${props.className ?? ''}`}
    >
      <span className="badge">Client Hydrate island</span>
      <h2>{props.title}</h2>
      <p>{strategyCopy[props.strategy]}</p>
      <Hydrate when={getStrategy(props.strategy)}>
        <CounterButton id={props.id} label={props.strategy} />
      </Hydrate>
    </div>
  )
}
