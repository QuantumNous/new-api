export interface ApiResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
}

export interface PasskeyStatus {
  enabled: boolean
  last_used_at?: string | null
  backup_eligible?: boolean
  backup_state?: boolean
  [key: string]: unknown
}

export interface PasskeyOptionsPayload {
  options?: unknown
  publicKey?: unknown
  response?: unknown
  Response?: unknown
}
