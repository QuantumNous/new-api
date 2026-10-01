import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import {
  CompositeComponent,
  createCompositeComponent,
  createFromFetch,
  renderServerComponent,
  renderToReadableStream,
} from '@tanstack/react-start/rsc'
import styles from './rsc-css-autoinject.module.css'
import { pageStyles } from '~/utils/styles'

type CardKind = 'renderable' | 'composite' | 'flight'

function SameFileCssModuleCard({
  kind,
  label,
}: {
  kind: CardKind
  label: string
}) {
  return (
    <section
      className={`${styles.card} ${styles[kind]}`}
      data-testid={`rsc-css-autoinject-${kind}`}
    >
      <span className={styles.badge}>auto injected css</span>
      <h2 className={styles.title}>{label}</h2>
      <p className={styles.description}>
        This server component is defined in the same route file as the RSC
        render call and uses a CSS module from that route file.
      </p>
    </section>
  )
}

const getRenderableCssModule = createServerFn({ method: 'GET' }).handler(
  async () => {
    return renderServerComponent(
      <SameFileCssModuleCard
        kind="renderable"
        label="renderServerComponent CSS"
      />,
    )
  },
)

const getCompositeCssModule = createServerFn({ method: 'GET' }).handler(
  async () => {
    return createCompositeComponent(() => ({
      Card: (
        <SameFileCssModuleCard
          kind="composite"
          label="createCompositeComponent CSS"
        />
      ),
    }))
  },
)

const getFlightCssModuleResponse = createServerFn({ method: 'GET' }).handler(
  async () => {
    const stream = renderToReadableStream(
      <SameFileCssModuleCard
        kind="flight"
        label="renderToReadableStream CSS"
      />,
    )

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/x-component',
      },
    })
  },
)

export const Route = createFileRoute('/rsc-css-autoinject')({
  loader: async () => {
    const [renderable, composite] = await Promise.all([
      getRenderableCssModule(),
      getCompositeCssModule(),
    ])

    return { renderable, composite }
  },
  component: RscCssAutoinjectComponent,
})

function RscCssAutoinjectComponent() {
  const { renderable, composite } = Route.useLoaderData()

  return (
    <div style={pageStyles.container} data-testid="rsc-css-autoinject-page">
      <h1 style={pageStyles.title}>RSC CSS Auto Injection</h1>
      <p style={pageStyles.description}>
        This route verifies Start injects RSC CSS resources for same-file CSS
        module server components across all Start RSC render APIs.
      </p>

      <div style={{ display: 'grid', gap: '16px' }}>
        {renderable}
        <CompositeComponent src={composite.Card} />
        <FlightCssModuleCard />
      </div>
    </div>
  )
}

function FlightCssModuleCard() {
  const [node, setNode] = React.useState<React.ReactNode>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false

    async function loadFlightCard() {
      try {
        const response = await getFlightCssModuleResponse()
        const result = await createFromFetch(Promise.resolve(response))
        if (!cancelled) {
          setNode(result)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e))
        }
      }
    }

    loadFlightCard()

    return () => {
      cancelled = true
    }
  }, [])

  if (error) {
    return <div data-testid="rsc-css-autoinject-flight-error">{error}</div>
  }

  return <>{node}</>
}
