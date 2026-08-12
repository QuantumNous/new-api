import { createFileRoute, useParams } from '@tanstack/react-router'

export const Route = createFileRoute('/params-ps/strict-false/$version')({
  params: {
    parse: (params) => ({
      ...params,
      version: parseInt(params.version),
    }),
    stringify: (params) => ({
      ...params,
      version: `${params.version}`,
    }),
  },
  component: RouteComponent,
})

function RouteComponent() {
  const { version } = useParams({ strict: false })

  return <div data-testid="strict-false-child-version">{String(version)}</div>
}
