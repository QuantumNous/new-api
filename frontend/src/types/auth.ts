export interface UserInfo {
  id: number
  username: string
  display_name: string
  email: string
  role: number
  quota: number
  used_quota: number
  admin_permissions?: string[]
}

export type UserProfilePatch = Partial<Pick<UserInfo, 'display_name' | 'email'>>
