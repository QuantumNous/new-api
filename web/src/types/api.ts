// 统一的后端响应与 DTO 类型

export type ApiResponse<T> = {
  success: boolean
  message: string
  data?: T
}

// 基础用户信息（登录返回）
export interface UserBasic {
  id: number
  username: string
  display_name?: string
  role: number
  status: number
  group?: string
}

// /api/user/self 返回会更丰富
export interface UserSelf extends UserBasic {
  email?: string
  quota?: number
  used_quota?: number
  request_count?: number
  aff_code?: string
  aff_count?: number
  aff_quota?: number
  aff_history_quota?: number
  inviter_id?: number
  linux_do_id?: string
  setting?: unknown
  stripe_customer?: string
  sidebar_modules?: unknown
  permissions?: unknown
}

export type User = UserSelf | UserBasic

export type LoginTwoFAData = { require_2fa: true }
export type LoginSuccessData = UserBasic
export type LoginResponse = ApiResponse<LoginTwoFAData | LoginSuccessData>
export type Verify2FAResponse = ApiResponse<UserBasic>
export type SelfResponse = ApiResponse<UserSelf>
