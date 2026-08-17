import type { OperationLogItem, OperationLogKind } from '@/types/console'

type Translate = (key: string, params?: Record<string, unknown>) => string

export const OPERATION_LOG_ACTION_LABEL_KEYS: Record<string, string> = {
  login: 'operationLogs.actions.login',
  'user.create': 'operationLogs.actions.userCreate',
  'user.update': 'operationLogs.actions.userUpdate',
  'user.delete': 'operationLogs.actions.userDelete',
  'user.delete_batch': 'operationLogs.actions.userDeleteBatch',
  'user.manage': 'operationLogs.actions.userManage',
  'user.quota_add': 'operationLogs.actions.userQuotaAdd',
  'user.quota_subtract': 'operationLogs.actions.userQuotaSubtract',
  'user.quota_override': 'operationLogs.actions.userQuotaOverride',
  'user.quota_adjust': 'operationLogs.actions.userQuotaAdjust',
  'user.binding_clear': 'operationLogs.actions.userBindingClear',
  'user.2fa_disable': 'operationLogs.actions.userTwoFactorForceDisable',
  'user.passkey_register': 'operationLogs.actions.userPasskeyRegister',
  'user.passkey_delete': 'operationLogs.actions.userPasskeyDelete',
  'user.topup_complete': 'operationLogs.actions.userTopupComplete',
  'user.reset_passkey': 'operationLogs.actions.userResetPasskey',
  'user.oauth_unbind': 'operationLogs.actions.userOauthUnbind',
  'user.status_update': 'operationLogs.actions.userStatusUpdate',
  'user.status_update_batch': 'operationLogs.actions.userStatusUpdateBatch',
  'user.checkin': 'operationLogs.actions.userCheckin',
  'user.security_verify': 'operationLogs.actions.userSecurityVerify',
  'user.2fa_setup_start': 'operationLogs.actions.userTwoFactorSetupStart',
  'user.2fa_enable': 'operationLogs.actions.userTwoFactorEnable',
  'user.2fa_self_disable': 'operationLogs.actions.userTwoFactorSelfDisable',
  'user.2fa_backup_codes_regenerate':
    'operationLogs.actions.userTwoFactorBackupCodesRegenerate',
  'user.registration_bonus': 'operationLogs.actions.userRegistrationBonus',
  'user.invitee_bonus': 'operationLogs.actions.userInviteeBonus',
  'user.inviter_bonus': 'operationLogs.actions.userInviterBonus',
  'option.update': 'operationLogs.actions.optionUpdate',
  'option.payment_compliance': 'operationLogs.actions.optionPaymentCompliance',
  'option.reset_ratio': 'operationLogs.actions.optionResetRatio',
  'option.clear_affinity_cache':
    'operationLogs.actions.optionClearAffinityCache',
  'custom_oauth.create': 'operationLogs.actions.customOauthCreate',
  'custom_oauth.update': 'operationLogs.actions.customOauthUpdate',
  'custom_oauth.delete': 'operationLogs.actions.customOauthDelete',
  'performance.clear_disk_cache':
    'operationLogs.actions.performanceClearDiskCache',
  'performance.gc': 'operationLogs.actions.performanceGc',
  'performance.clear_logs': 'operationLogs.actions.performanceClearLogs',
  'channel.create': 'operationLogs.actions.channelCreate',
  'channel.update': 'operationLogs.actions.channelUpdate',
  'channel.delete': 'operationLogs.actions.channelDelete',
  'channel.delete_batch': 'operationLogs.actions.channelDeleteBatch',
  'channel.delete_disabled': 'operationLogs.actions.channelDeleteDisabled',
  'channel.key_view': 'operationLogs.actions.channelKeyView',
  'channel.status_update': 'operationLogs.actions.channelStatusUpdate',
  'channel.status_update_batch':
    'operationLogs.actions.channelStatusUpdateBatch',
  'channel.tag_disable': 'operationLogs.actions.channelTagDisable',
  'channel.tag_enable': 'operationLogs.actions.channelTagEnable',
  'channel.tag_edit': 'operationLogs.actions.channelTagEdit',
  'channel.tag_batch_set': 'operationLogs.actions.channelTagBatchSet',
  'channel.copy': 'operationLogs.actions.channelCopy',
  'channel.multi_key_manage': 'operationLogs.actions.channelMultiKeyManage',
  'channel.upstream_apply': 'operationLogs.actions.channelUpstreamApply',
  'channel.upstream_apply_all': 'operationLogs.actions.channelUpstreamApplyAll',
  'channel.upstream_detect_all':
    'operationLogs.actions.channelUpstreamDetectAll',
  'redemption.create': 'operationLogs.actions.redemptionCreate',
  'redemption.update': 'operationLogs.actions.redemptionUpdate',
  'redemption.delete': 'operationLogs.actions.redemptionDelete',
  'redemption.delete_invalid': 'operationLogs.actions.redemptionDeleteInvalid',
  'redemption.delete_batch': 'operationLogs.actions.redemptionDeleteBatch',
  'redemption.status_update': 'operationLogs.actions.redemptionStatusUpdate',
  'prefill_group.create': 'operationLogs.actions.prefillGroupCreate',
  'prefill_group.update': 'operationLogs.actions.prefillGroupUpdate',
  'prefill_group.delete': 'operationLogs.actions.prefillGroupDelete',
  'vendor.create': 'operationLogs.actions.vendorCreate',
  'vendor.update': 'operationLogs.actions.vendorUpdate',
  'vendor.delete': 'operationLogs.actions.vendorDelete',
  'model.create': 'operationLogs.actions.modelCreate',
  'model.update': 'operationLogs.actions.modelUpdate',
  'model.delete': 'operationLogs.actions.modelDelete',
  'model.sync_upstream': 'operationLogs.actions.modelSyncUpstream',
  'deployment.create': 'operationLogs.actions.deploymentCreate',
  'deployment.update': 'operationLogs.actions.deploymentUpdate',
  'deployment.delete': 'operationLogs.actions.deploymentDelete',
  'subscription.plan_create': 'operationLogs.actions.subscriptionPlanCreate',
  'subscription.plan_update': 'operationLogs.actions.subscriptionPlanUpdate',
  'subscription.bind': 'operationLogs.actions.subscriptionBind',
  'subscription.plan_reset': 'operationLogs.actions.subscriptionPlanReset',
  'subscription.user_plan_reset':
    'operationLogs.actions.subscriptionUserPlanReset',
  'log.cleanup_start': 'operationLogs.actions.logCleanupStart',
  generic: 'operationLogs.actions.generic',
}

const PARAM_LABEL_KEYS: Record<string, string> = {
  id: 'operationLogs.params.id',
  target_user_id: 'operationLogs.params.targetUserId',
  username: 'operationLogs.params.username',
  role: 'operationLogs.params.role',
  action: 'operationLogs.params.action',
  quota: 'operationLogs.params.quota',
  from: 'operationLogs.params.from',
  to: 'operationLogs.params.to',
  delta: 'operationLogs.params.delta',
  status: 'operationLogs.params.status',
  count: 'operationLogs.params.count',
  name: 'operationLogs.params.name',
  type: 'operationLogs.params.type',
  tag: 'operationLogs.params.tag',
  key: 'operationLogs.params.key',
  method: 'operationLogs.params.method',
  scope: 'operationLogs.params.scope',
  route: 'operationLogs.params.route',
  plan_id: 'operationLogs.params.planId',
  inviter_id: 'operationLogs.params.inviterId',
  invited_user_id: 'operationLogs.params.invitedUserId',
  bindingType: 'operationLogs.params.bindingType',
  sourceId: 'operationLogs.params.sourceId',
  changed_fields: 'operationLogs.params.changedFields',
}

export function operationLogSummary(
  log: OperationLogItem,
  t: Translate
): string {
  const key = OPERATION_LOG_ACTION_LABEL_KEYS[log.action]
  if (key) return t(key, log.params)
  return log.content || log.action || t('operationLogs.unknownAction')
}

export function operationLogKindKey(kind: OperationLogKind): string {
  return `operationLogs.kind.${kind}`
}

export function operationLogKindTone(
  kind: OperationLogKind
): 'accent' | 'info' | 'warning' {
  if (kind === 'manage') return 'accent'
  if (kind === 'login') return 'info'
  return 'warning'
}

export function operationLogResultKey(log: OperationLogItem): string {
  if (log.request?.success === true) return 'operationLogs.result.success'
  if (log.request?.success === false) return 'operationLogs.result.failed'
  return 'operationLogs.result.unknown'
}

export function operationLogResultTone(
  log: OperationLogItem
): 'success' | 'danger' | 'neutral' {
  if (log.request?.success === true) return 'success'
  if (log.request?.success === false) return 'danger'
  return 'neutral'
}

export function operationLogRoleKey(role: number | null): string {
  if (role === null) return 'operationLogs.role.unknown'
  if (role >= 100) return 'operationLogs.role.root'
  if (role >= 10) return 'operationLogs.role.admin'
  return 'operationLogs.role.user'
}

export function operationLogAuthMethodKey(method: string): string | null {
  if (method === 'session') return 'operationLogs.auth.session'
  if (method === 'access_token') return 'operationLogs.auth.accessToken'
  if (method === 'password') return 'operationLogs.auth.password'
  if (method === '2fa') return 'operationLogs.auth.twoFactor'
  if (method === 'passkey') return 'operationLogs.auth.passkey'
  if (method.startsWith('oauth:')) return 'operationLogs.auth.oauth'
  return null
}

export function operationLogParamLabel(key: string, t: Translate): string {
  const labelKey = PARAM_LABEL_KEYS[key]
  return labelKey ? t(labelKey) : key
}

export function operationLogParamValue(value: unknown): string {
  if (value === null || value === undefined) return '-'
  if (Array.isArray(value)) return value.map(String).join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export function operationLogRequestText(log: OperationLogItem): string {
  const method = log.request?.method ?? ''
  const route = log.request?.route || log.request?.path || ''
  return [method, route].filter(Boolean).join(' ')
}
