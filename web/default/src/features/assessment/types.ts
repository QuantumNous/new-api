export interface Assessment {
  id: number
  title: string
  description: string
  start_time: number
  end_time: number
  status: number
  max_score: number
  created_by: number
  created_at: number
  updated_at: number
}

export interface AssessmentSubmission {
  id: number
  assessment_id: number
  user_id: number
  content: string
  screenshots: string[]
  status: number
  score: number | null
  comment: string
  reviewed_by: number
  submitted_at: number
  reviewed_at: number
}

export interface AssessmentWithSubmission extends Assessment {
  submitted: boolean
  score: number | null
  submission_status: number
}

export interface SubmissionWithAssessment extends AssessmentSubmission {
  assessment_title: string
}

export interface SubmissionWithUser extends AssessmentSubmission {
  username: string
  email: string
}

export interface AssessmentStats {
  total: number
  pending: number
  passed: number
  failed: number
  average_score: number
}

export interface MyStats {
  total_submissions: number
  passed: number
  average_score: number
}

export const ASSESSMENT_STATUS = {
  PENDING: 0,
  ACTIVE: 1,
  CLOSED: 2,
} as const

export const SUBMISSION_STATUS = {
  PENDING: 0,
  PASSED: 1,
  FAILED: 2,
} as const
