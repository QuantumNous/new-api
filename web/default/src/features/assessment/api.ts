import { api } from '@/lib/api'
import type {
  Assessment,
  AssessmentWithSubmission,
  SubmissionWithAssessment,
  SubmissionWithUser,
  AssessmentStats,
  MyStats,
} from './types'

export async function getActiveAssessments(): Promise<{ success: boolean; data: AssessmentWithSubmission[] }> {
  const res = await api.get('/api/assessment/active')
  return res.data
}

export async function getMySubmissions(): Promise<{ success: boolean; data: SubmissionWithAssessment[] }> {
  const res = await api.get('/api/assessment/my')
  return res.data
}

export async function getMyStats(): Promise<{ success: boolean; data: MyStats }> {
  const res = await api.get('/api/assessment/my/stats')
  return res.data
}

export async function submitAssessment(formData: FormData): Promise<{ success: boolean; data: AssessmentSubmission }> {
  const res = await api.post('/api/assessment/submit', formData)
  return res.data
}

export async function uploadScreenshot(file: File): Promise<{ success: boolean; data: { filename: string } }> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await api.post('/api/assessment/upload', formData)
  return res.data
}

export async function getAllAssessments(): Promise<{ success: boolean; data: Assessment[] }> {
  const res = await api.get('/api/assessment/admin/')
  return res.data
}

export async function createAssessment(data: Partial<Assessment>): Promise<{ success: boolean; data: Assessment }> {
  const res = await api.post('/api/assessment/admin/', data)
  return res.data
}

export async function updateAssessment(data: Partial<Assessment> & { id: number }): Promise<{ success: boolean; data: Assessment }> {
  const res = await api.put('/api/assessment/admin/', data)
  return res.data
}

export async function deleteAssessment(id: number): Promise<{ success: boolean }> {
  const res = await api.delete(`/api/assessment/admin/${id}`)
  return res.data
}

export async function getAssessmentSubmissions(assessmentId: number): Promise<{ success: boolean; data: SubmissionWithUser[] }> {
  const res = await api.get(`/api/assessment/admin/submissions/${assessmentId}`)
  return res.data
}

export async function reviewSubmission(data: { id: number; status: number; score: number; comment: string }): Promise<{ success: boolean }> {
  const res = await api.post('/api/assessment/admin/review', data)
  return res.data
}

export async function getAssessmentStats(assessmentId: number): Promise<{ success: boolean; data: AssessmentStats }> {
  const res = await api.get(`/api/assessment/admin/stats/${assessmentId}`)
  return res.data
}
