export type SettingsNotifyType = 'email' | 'webhook' | 'bark' | 'gotify'

export type SettingsBindingId =
  | 'email'
  | 'github'
  | 'linuxdo'
  | 'discord'
  | 'oidc'
  | 'wechat'
  | 'telegram'
  | `custom:${number}`

export interface SettingsBinding {
  id: SettingsBindingId
  bound: boolean
  account: string
  providerId?: number
  providerSlug?: string
  providerName?: string
  providerIcon?: string
}

export interface NotificationSettings {
  notifyType: SettingsNotifyType
  quotaWarningThreshold: number
  notificationEmail: string
  webhookUrl: string
  webhookSecret: string
  barkUrl: string
  gotifyUrl: string
  gotifyToken: string
  gotifyPriority: number
  walletReminder: boolean
  subscriptionReminder: boolean
  upstreamModelUpdateNotify: boolean
  acceptUnsetModelPrice: boolean
  recordIpLog: boolean
}
