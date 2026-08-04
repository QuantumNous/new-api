export interface UserInfo {
  id: number
  username: string
  display_name: string
  email: string
  role: number
  quota: number
  used_quota: number
  github_id?: string
  discord_id?: string
  oidc_id?: string
  wechat_id?: string
  telegram_id?: string
  linux_do_id?: string
  admin_permissions?: string[]
}

export type UserProfilePatch = Partial<Pick<UserInfo, 'display_name' | 'email'>>
