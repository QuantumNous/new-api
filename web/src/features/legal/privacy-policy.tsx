import { getPrivacyPolicy } from './api'
import { LegalDocument } from './legal-document'

export function PrivacyPolicy() {
  return (
    <LegalDocument
      title='Privacy Policy'
      queryKey='privacy-policy'
      fetchDocument={getPrivacyPolicy}
      emptyMessage='The administrator has not configured a privacy policy yet.'
    />
  )
}
