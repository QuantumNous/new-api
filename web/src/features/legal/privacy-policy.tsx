import { useTranslation } from 'react-i18next'
import { getPrivacyPolicy } from './api'
import { LegalDocument } from './legal-document'

export function PrivacyPolicy() {
  const { t } = useTranslation()
  return (
    <LegalDocument
      title={t('Privacy Policy')}
      queryKey='privacy-policy'
      fetchDocument={getPrivacyPolicy}
      emptyMessage={t(
        'The administrator has not configured a privacy policy yet.'
      )}
    />
  )
}
