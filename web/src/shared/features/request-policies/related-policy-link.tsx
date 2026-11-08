import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { ROLE } from '@/shared/lib/roles'
import { useAuthStore } from '@/shared/stores/auth-store'



export function RelatedPolicyLink(props: { section: 'routing' | 'health' }) {
  const { t } = useTranslation()
  const isRoot = useAuthStore(
    (state) => state.auth.user?.role === ROLE.SUPER_ADMIN
  )
  if (!isRoot) return null
  return (
    <Link
      className='text-primary ms-1 underline underline-offset-4'
      to='/admin/system-settings/request-policies/$section'
      params={{ section: props.section }}
    >
      {t('Request policies')}
    </Link>
  )
}

