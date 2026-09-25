/// <reference types="vite/client" />
import {
  Body,
  HeadContent,
  Html,
  Scripts,
  createRootRoute,
} from '@tanstack/vue-router'
import { AppShell } from '~/components/AppShell'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'TanStack Start Manifest Bloat E2E' },
    ],
  }),
  component: AppShell,
  shellComponent: RootDocument,
})

function RootDocument(_: unknown, { slots }: { slots: any }) {
  return (
    <Html>
      <head>
        <HeadContent />
      </head>
      <Body>
        {slots.default?.()}
        <Scripts />
      </Body>
    </Html>
  )
}
