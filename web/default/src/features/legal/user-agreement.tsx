import { useTranslation } from 'react-i18next'
import { getUserAgreement } from './api'
import { LegalDocument } from './legal-document'

export function UserAgreement() {
  const { t } = useTranslation()
  return (
    <LegalDocument
      title={t('User Agreement')}
      queryKey='user-agreement'
      fetchDocument={getUserAgreement}
      emptyMessage={t(
        'The administrator has not configured a user agreement yet.'
      )}
    />
  )
}
