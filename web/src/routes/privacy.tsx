import { createFileRoute, Link } from '@tanstack/react-router'

import { OrbitPublicPage } from '@/features/home/components/orbit-landing'
import { ORBIT_BRAND } from '@/lib/orbit-brand'

function OrbitPrivacy() {
  return (
    <OrbitPublicPage title='Privacy' active='/privacy'>
      <p>
        This is a development preview. A final privacy notice, operator
        identity, contact method, and retention policy must be published before
        collecting public applications.
      </p>
      <p>
        The underlying gateway supports account details, API key records,
        request logs, and usage tracking. Administrators control instance
        configuration. Do not submit student documents to this preview. Never
        include API keys or personal information in public issues.
      </p>
      <p>
        <Link to='/docs'>Development documentation</Link> ·{' '}
        <a href={ORBIT_BRAND.source}>Project repository</a>
      </p>
    </OrbitPublicPage>
  )
}
export const Route = createFileRoute('/privacy')({ component: OrbitPrivacy })
