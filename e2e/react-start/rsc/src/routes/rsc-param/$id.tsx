import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import {
  CompositeComponent,
  createCompositeComponent,
  renderServerComponent,
} from '@tanstack/react-start/rsc'
import { ClientRenderedDirect } from '~/utils/rsc-param/ClientRenderedDirect'
import { SlotChild } from '~/utils/rsc-param/SlotChild'
import { SlotRenderProp } from '~/utils/rsc-param/SlotRenderProp'
import {
  serverBadge,
  serverBox,
  serverHeader,
  timestamp,
} from '~/utils/serverStyles'
import { clientStyles, pageStyles } from '~/utils/styles'

const getParamRsc = createServerFn({ method: 'GET' })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const serverTimestamp = Date.now()

    const Renderable = await renderServerComponent(
      <div style={serverBox} data-testid="rsc-param-renderable">
        <div style={serverHeader}>
          <span style={serverBadge}>SERVER RENDERABLE</span>
          <span style={timestamp}>
            {new Date(serverTimestamp).toLocaleTimeString()}
          </span>
        </div>

        <div data-testid="rsc-param-renderable-id">id: {data.id}</div>

        <div style={{ marginTop: '8px' }}>
          <ClientRenderedDirect />
        </div>
      </div>,
    )

    const Composite = await createCompositeComponent(
      (props: {
        children?: React.ReactNode
        renderFooter?: () => React.ReactNode
      }) => (
        <div style={serverBox} data-testid="rsc-param-composite">
          <div style={serverHeader}>
            <span style={serverBadge}>SERVER COMPOSITE</span>
            <span style={timestamp}>
              {new Date(serverTimestamp).toLocaleTimeString()}
            </span>
          </div>

          <div data-testid="rsc-param-composite-id">id: {data.id}</div>

          <div
            style={{
              borderTop: '1px solid #bae6fd',
              paddingTop: '12px',
              marginTop: '12px',
              marginBottom: '12px',
            }}
          >
            <div
              style={{
                fontSize: '11px',
                color: '#0369a1',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '8px',
              }}
            >
              Client Slot
            </div>
            <div data-testid="rsc-param-slot-children">{props.children}</div>
          </div>

          <div
            style={{
              borderTop: '1px solid #bae6fd',
              paddingTop: '12px',
            }}
            data-testid="rsc-param-slot-footer"
          >
            {props.renderFooter?.()}
          </div>
        </div>
      ),
    )

    return {
      Renderable,
      Composite,
      id: data.id,
    }
  })

export const Route = createFileRoute('/rsc-param/$id')({
  loader: async ({ params }) => {
    const result = await getParamRsc({
      data: { id: params.id },
    })
    return {
      ...result,
      loaderTimestamp: Date.now(),
    }
  },
  component: RscParamIdComponent,
  pendingComponent: () => {
    return (
      <div style={pageStyles.container} data-testid="rsc-param-page">
        <h1 style={pageStyles.title}>Loading RSC path param…</h1>
        <p style={pageStyles.description}>Loading...</p>
      </div>
    )
  },
})

function RscParamIdComponent() {
  const { id, Renderable, Composite } = Route.useLoaderData()

  return (
    <div style={pageStyles.container} data-testid="rsc-param-page">
      <h1 style={pageStyles.title}>RSC path param: {id}</h1>
      <p style={pageStyles.description}>
        This page mixes a renderable RSC that renders a client component
        directly and a composite RSC with slots.
      </p>

      <div style={clientStyles.container} data-testid="rsc-param-controls">
        <div style={clientStyles.header}>
          <span style={clientStyles.badge}>CLIENT NAV</span>
        </div>

        <Route.Link
          to="/rsc-param/$id"
          params={{ id: id === 'alpha' ? 'bravo' : 'alpha' }}
          data-testid="rsc-param-next-link"
          style={{
            display: 'inline-block',
            padding: '8px 16px',
            borderRadius: '6px',
            backgroundColor: '#16a34a',
            color: 'white',
            fontWeight: 'bold',
            textDecoration: 'none',
          }}
        >
          Navigate to id={id === 'alpha' ? 'bravo' : 'alpha'}
        </Route.Link>
      </div>

      {Renderable}

      <CompositeComponent
        src={Composite}
        renderFooter={() => <SlotRenderProp />}
      >
        <SlotChild />
      </CompositeComponent>
    </div>
  )
}
