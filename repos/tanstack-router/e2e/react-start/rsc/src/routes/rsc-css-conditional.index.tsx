import { Link, createFileRoute } from '@tanstack/react-router'
import { pageStyles } from '~/utils/styles'

export const Route = createFileRoute('/rsc-css-conditional/')({
  component: RscCssConditionalIndexRoute,
})

function RscCssConditionalIndexRoute() {
  return (
    <div style={pageStyles.container}>
      <h1
        data-testid="rsc-css-conditional-index-title"
        style={pageStyles.title}
      >
        Conditional RSC CSS
      </h1>
      <p style={pageStyles.description}>
        Choose a route variant to verify that each branch renders its own CSS
        module without leaking styles.
      </p>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <Link
          to="/rsc-css-conditional/$branch"
          params={{ branch: 'orange' }}
          data-testid="rsc-css-conditional-link-orange"
        >
          Orange Variant
        </Link>
        <Link
          to="/rsc-css-conditional/$branch"
          params={{ branch: 'violet' }}
          data-testid="rsc-css-conditional-link-violet"
        >
          Violet Variant
        </Link>
      </div>
    </div>
  )
}
