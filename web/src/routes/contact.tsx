import { createFileRoute, Link } from '@tanstack/react-router'

import { OrbitPublicPage } from '@/features/home/components/orbit-landing'
import { ORBIT_BRAND } from '@/lib/orbit-brand'

function OrbitContact() {
  return (
    <OrbitPublicPage title='Contact Orbit' active='/contact'>
      <p>
        Public support and transactional email channels are not operational yet.
      </p>
      <p>
        For software bugs and code contributions, use the public Orbit
        repository. Do not post passwords, API keys, verification documents, or
        personal account details in issues.
      </p>
      <p>
        <Link to='/docs'>Development documentation</Link> ·{' '}
        <a href={ORBIT_BRAND.source}>Project repository</a>
      </p>
    </OrbitPublicPage>
  )
}
export const Route = createFileRoute('/contact')({ component: OrbitContact })
