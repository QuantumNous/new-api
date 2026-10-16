// Current TanStack Start RSC pattern.
// Replace route paths and data sources with your own app code.

import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { renderServerComponent } from '@tanstack/react-start/rsc'

function Greeting() {
  return <h1>Hello from TanStack Start RSC</h1>
}

const getGreeting = createServerFn({ method: 'GET' }).handler(async () => {
  const Renderable = await renderServerComponent(<Greeting />)
  return { Renderable }
})

export const Route = createFileRoute('/hello')({
  loader: async () => {
    const { Renderable } = await getGreeting()
    return { Greeting: Renderable }
  },
  component: HelloPage,
})

function HelloPage() {
  const { Greeting } = Route.useLoaderData()
  return <>{Greeting}</>
}
