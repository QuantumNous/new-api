import { ClientOnly, createFileRoute, Link } from '@tanstack/react-router'
import { getConditionalCssServerComponent } from '~/utils/conditionalCssServerComponent'
import { pageStyles } from '~/utils/styles'

export const Route = createFileRoute('/rsc-css-conditional/$branch')({
  loader: async ({ params: { branch } }) => {
    const activeBranch = branch === 'violet' ? 'violet' : 'orange'
    const Server = await getConditionalCssServerComponent({
      data: { branch: activeBranch },
    })

    return {
      Server,
      branch: activeBranch,
    }
  },
  component: RscCssConditionalRoute,
})

function RscCssConditionalRoute() {
  const { Server, branch } = Route.useLoaderData()

  return (
    <div style={pageStyles.container}>
      <h1 data-testid="rsc-css-conditional-title" style={pageStyles.title}>
        Conditional RSC CSS
      </h1>
      <p
        data-testid="rsc-css-conditional-branch"
        style={pageStyles.description}
      >
        Active branch: {branch}
      </p>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
        <Link
          to="/rsc-css-conditional"
          data-testid="rsc-css-conditional-back-link"
        >
          Back to variants
        </Link>
        <Link
          to="/rsc-css-conditional/$branch"
          params={{ branch: branch === 'orange' ? 'violet' : 'orange' }}
          data-testid="rsc-css-conditional-switch-link"
        >
          Switch variant
        </Link>
      </div>

      <ClientOnly>
        <div data-testid="rsc-css-conditional-hydrated">hydrated</div>
      </ClientOnly>

      {Server}
    </div>
  )
}
