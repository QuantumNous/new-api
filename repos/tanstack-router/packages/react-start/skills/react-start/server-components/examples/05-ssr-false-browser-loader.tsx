// Browser-owned loader pattern.
// Use when the loader itself needs browser APIs such as localStorage.

import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { renderServerComponent } from '@tanstack/react-start/rsc'
import { z } from 'zod'

const getDrawingTools = createServerFn({ method: 'POST' })
  .validator(z.object({ savedState: z.string().nullable() }))
  .handler(async ({ data }) => {
    const Tools = await renderServerComponent(
      <ToolPalette savedState={data.savedState} />,
    )

    return { Tools }
  })

export const Route = createFileRoute('/canvas')({
  ssr: false,
  loader: async () => {
    const savedState = localStorage.getItem('canvas-state')
    return getDrawingTools({ data: { savedState } })
  },
  component: CanvasPage,
})

function CanvasPage() {
  const { Tools } = Route.useLoaderData()
  return <>{Tools}</>
}

function ToolPalette(props: { savedState: string | null }) {
  return (
    <section>
      <h1>Canvas tools</h1>
      <pre>{props.savedState ?? 'no saved state'}</pre>
    </section>
  )
}
