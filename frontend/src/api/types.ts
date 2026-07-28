/** Backend business envelope: every /api response uses this shape. */
export interface ApiResponse<T> {
  success: boolean
  message?: string
  data: T
}

/**
 * Distinguishes transport-level HTTP errors from HTTP 200 responses
 * carrying { success: false } (integration contract §4 / §7).
 */
export class ApiError extends Error {
  readonly status?: number
  /** true when the server answered 200 with success:false */
  readonly business: boolean

  constructor(
    message: string,
    options?: { status?: number; business?: boolean; cause?: unknown }
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = options?.status
    this.business = options?.business ?? false
    if (options?.cause !== undefined) this.cause = options.cause
  }
}

export interface PageResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface TokenSecretResponse {
  key: string
}
