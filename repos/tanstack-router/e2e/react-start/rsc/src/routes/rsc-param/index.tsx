import { createFileRoute, Link } from '@tanstack/react-router'
import { pageStyles } from '~/utils/styles'

export const Route = createFileRoute('/rsc-param/')({
  component: RscParamIndexComponent,
})

const ids = ['alpha', 'bravo', 'charlie']

function RscParamIndexComponent() {
  return (
    <div style={pageStyles.container} data-testid="rsc-param-index">
      <h1 style={pageStyles.title}>RSC Param Routes</h1>
      <p style={pageStyles.description}>
        Links to a dynamic <code>/rsc-param/$id</code> route.
      </p>

      <div style={pageStyles.section}>
        <div style={pageStyles.sectionTitle}>Examples</div>
        <ul style={{ margin: 0, paddingLeft: '20px' }}>
          {ids.map((id) => (
            <li key={id} style={{ marginBottom: '8px' }}>
              <Link
                to="/rsc-param/$id"
                params={{ id }}
                data-testid={`rsc-param-index-link-${id}`}
              >
                /rsc-param/{id}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
