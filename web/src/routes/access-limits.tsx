import { createFileRoute, Link } from '@tanstack/react-router'

import { OrbitPublicPage } from '@/features/home/components/orbit-landing'
import { ORBIT_BRAND } from '@/lib/orbit-brand'

function OrbitAccessLimits() {
  return (
    <OrbitPublicPage title='Access & Limits' active='/access-limits'>
      <p>
        Planned policy · These limits are not implemented or enforced by the
        Phase 1 interface. Current configured allowances appear in your
        dashboard.
      </p>
      <p>
        Unverified accounts: 10 requests per minute, 1 million chargeable tokens
        per four-hour window, and 4 million chargeable tokens per day. Verified
        BEU students: 15 requests per minute; standard token caps removed,
        subject to fair use and provider availability. Student verification and
        limit-increase requests are planned. No unlimited usage or access to
        every premium model is promised.
      </p>
      <p>
        <Link to='/docs'>Development documentation</Link> ·{' '}
        <a href={ORBIT_BRAND.source}>Project repository</a>
      </p>
    </OrbitPublicPage>
  )
}
export const Route = createFileRoute('/access-limits')({
  component: OrbitAccessLimits,
})
