import * as React from 'react'
import { DeferredHydrateIsland } from '../components/DeferredHydrateIsland'
import { CssHydrateIsland } from '../components/CssHydrateIsland'

export function ServerClientHydrateContent({
  renderedAt,
}: {
  renderedAt: string
}) {
  return (
    <section
      className="strategy-card server-frame"
      data-testid="server-client-rsc"
    >
      <span className="badge">React Server Component</span>
      <h1>Server component renders a deferred client island</h1>
      <p>
        Server rendered at <time>{renderedAt}</time>. The button below is
        present in HTML but stays unhydrated until interaction.
      </p>
      <DeferredHydrateIsland
        id="server-client"
        title="Interaction strategy inside RSC output"
        strategy="interaction"
      />
    </section>
  )
}

export function CompositeHydrateContent({
  children,
}: {
  children?: React.ReactNode
}) {
  return (
    <section className="strategy-card server-frame" data-testid="composite-rsc">
      <span className="badge">Composite Server Component</span>
      <h1>Server shell, client Hydrate slot</h1>
      <p>
        The server owns this descriptive shell. The client slot below remains
        server HTML until an interaction reaches it.
      </p>
      <div style={{ height: '110vh' }} data-testid="composite-scroll-spacer" />
      {children}
    </section>
  )
}

export function CssModuleHydrateContent() {
  return (
    <section className="strategy-card server-frame" data-testid="css-rsc">
      <span className="badge">
        Server Component plus CSS module client island
      </span>
      <h1>CSS module Hydrate boundary</h1>
      <p>
        This server component renders a separate client component that uses
        Hydrate and CSS modules.
      </p>
      <CssHydrateIsland />
    </section>
  )
}
