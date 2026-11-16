import { createFileRoute, Link } from '@tanstack/react-router'

import { OrbitPublicPage } from '@/features/home/components/orbit-landing'
import { ORBIT_BRAND } from '@/lib/orbit-brand'

function OrbitTerms() {
  return (
    <OrbitPublicPage title='Terms of Service' active='/terms'>
      <p>
        Orbit is a community AI gateway under development. Public service terms
        have not been finalized. This development preview does not grant access
        to any provider or promise availability.
      </p>
      <p>
        Use accounts and API keys responsibly. Respect applicable laws, provider
        rules, and the rights of others. Do not abuse shared capacity. Final
        service terms and an operator contact must be published before public
        launch.
      </p>
      <p>
        <Link to='/docs'>Development documentation</Link> ·{' '}
        <a href={ORBIT_BRAND.source}>Project repository</a>
      </p>
    </OrbitPublicPage>
  )
}
export const Route = createFileRoute('/terms')({ component: OrbitTerms })
