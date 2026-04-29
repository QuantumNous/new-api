import { api } from '@/lib/api'
import type { LegalDocumentResponse } from './types'

export async function getUserAgreement() {
  const res = await api.get<LegalDocumentResponse>('/api/user-agreement')
  return res.data
}

export async function getPrivacyPolicy() {
  const res = await api.get<LegalDocumentResponse>('/api/privacy-policy')
  return res.data
}
