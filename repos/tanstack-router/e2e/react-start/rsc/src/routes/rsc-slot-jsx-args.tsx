import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import {
  CompositeComponent,
  createCompositeComponent,
} from '@tanstack/react-start/rsc'
import { clientStyles, pageStyles } from '~/utils/styles'
import {
  serverBadge,
  serverBox,
  serverHeader,
  timestamp,
} from '~/utils/serverStyles'

// ============================================================================
// SLOT ARGS: Passing JSX as a slot argument
// ============================================================================

const getPromoServerComponent = createServerFn({ method: 'GET' })
  .validator((data: { headline: string }) => data)
  .handler(async ({ data }) => {
    const serverTimestamp = Date.now()

    return createCompositeComponent(
      (props: {
        renderCta?: (
          cta: React.ReactElement,
          meta: { campaignId: string },
        ) => React.ReactNode
      }) => {
        return (
          <div style={serverBox} data-testid="rsc-jsx-args-server">
            <div style={serverHeader}>
              <span style={serverBadge}>SERVER PROMO</span>
              <span style={timestamp} data-testid="rsc-jsx-args-timestamp">
                Fetched: {new Date(serverTimestamp).toLocaleTimeString()}
              </span>
            </div>

            <h2 style={{ margin: 0, color: '#0c4a6e' }}>{data.headline}</h2>
            <p style={{ margin: '8px 0 0 0', color: '#0369a1' }}>
              Server renders the layout. Client renders the CTA.
            </p>

            <div
              style={{
                borderTop: '1px solid #bae6fd',
                paddingTop: '12px',
                marginTop: '12px',
              }}
            >
              {props.renderCta?.(
                <strong data-testid="promo-cta-jsx">Limited offer</strong>,
                { campaignId: 'CMP-123' },
              )}
            </div>
          </div>
        )
      },
    )
  })

export const Route = createFileRoute('/rsc-slot-jsx-args')({
  loader: async () => {
    const Server = await getPromoServerComponent({
      data: { headline: 'Early Access Promotion' },
    })

    return { Server }
  },
  component: RscSlotJsxArgsPage,
})

function RscSlotJsxArgsPage() {
  const { Server } = Route.useLoaderData()

  return (
    <div style={pageStyles.container}>
      <h1 style={pageStyles.title}>Slot Args: JSX Element</h1>
      <p style={pageStyles.description}>
        Server calls a client slot with a JSX element argument. The client slot
        renders the element.
      </p>

      <CompositeComponent
        src={Server}
        renderCta={(cta: React.ReactElement, meta: { campaignId: string }) => (
          <div style={clientStyles.container} data-testid="rsc-jsx-args-client">
            <div style={clientStyles.header}>
              <span style={clientStyles.badge}>CLIENT CTA</span>
            </div>

            <div data-testid="rsc-jsx-args-cta">{cta}</div>
            <div
              data-testid="rsc-jsx-args-meta"
              style={{ marginTop: '8px', fontSize: '12px', color: '#166534' }}
            >
              campaign: {meta.campaignId}
            </div>
          </div>
        )}
      />
    </div>
  )
}
