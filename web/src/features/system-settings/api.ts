/*
  Data backup / restore API client
*/
import { api } from '@/lib/api'
import { getFreshAuthHeaders } from '@/lib/api'

export interface BackupCategoryItem {
  key: string
  display: string
  is_large: boolean
}

export interface BackupPreviewResponse {
  category: string
  rows: number
}

export interface BackupImportResult {
  category: string
  imported: number
  skipped: number
  errors: number
  error_msg?: string
}

export async function getBackupCategories(): Promise<BackupCategoryItem[]> {
  const res = await api.get('/api/backup/categories')
  return res.data.data ?? []
}

export async function getBackupPreview(
  category: string
): Promise<BackupPreviewResponse> {
  const res = await api.get('/api/backup/preview', {
    params: { category },
  })
  return res.data.data
}

export interface ExportBackupPayload {
  categories: string[]
  include_secret: boolean
}

export async function exportBackup(
  payload: ExportBackupPayload
): Promise<Blob> {
  const headers = await getFreshAuthHeaders()
  const res = await api.post('/api/backup/export', payload, {
    responseType: 'blob',
    headers,
  })
  return res.data as Blob
}

export interface ImportBackupPayload {
  file: File
  categories: string[]
  skip_existing: boolean
  overwrite_secret: boolean
}

export interface ImportBackupResponse {
  filename: string
  results: BackupImportResult[]
}

export async function importBackup(
  payload: ImportBackupPayload
): Promise<ImportBackupResponse> {
  const form = new FormData()
  form.append('file', payload.file)
  if (payload.categories.length > 0) {
    form.append('categories', payload.categories.join(','))
  }
  form.append('skip_existing', String(payload.skip_existing))
  form.append('overwrite_secret', String(payload.overwrite_secret))

  const headers = await getFreshAuthHeaders()
  const res = await api.post('/api/backup/import', form, {
    headers: {
      ...headers,
      'Content-Type': 'multipart/form-data',
    },
  })
  return res.data.data
}
