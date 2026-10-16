import * as React from 'react'
import { createServerFn } from '@tanstack/react-start'
import {
  createCompositeComponent,
  renderServerComponent,
} from '@tanstack/react-start/rsc'
import {
  CompositeHydrateContent,
  CssModuleHydrateContent,
  ServerClientHydrateContent,
} from './serverHydrateContent'

export const getServerClientHydrate = createServerFn({ method: 'GET' }).handler(
  async () => {
    const renderedAt = new Date().toISOString()

    return renderServerComponent(
      <ServerClientHydrateContent renderedAt={renderedAt} />,
    )
  },
)

export const getCompositeHydrate = createServerFn({ method: 'GET' }).handler(
  async () => {
    return createCompositeComponent((props: { children?: React.ReactNode }) => (
      <CompositeHydrateContent>{props.children}</CompositeHydrateContent>
    ))
  },
)

export const getCssModuleHydrate = createServerFn({ method: 'GET' }).handler(
  async () => {
    return renderServerComponent(<CssModuleHydrateContent />)
  },
)
