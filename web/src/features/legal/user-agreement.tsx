import { getUserAgreement } from './api'
import { LegalDocument } from './legal-document'

export function UserAgreement() {
  return (
    <LegalDocument
      title='User Agreement'
      queryKey='user-agreement'
      fetchDocument={getUserAgreement}
      emptyMessage='The administrator has not configured a user agreement yet.'
    />
  )
}
