import { buildQuotaAuditOperation } from '../../lib/quota-audit-operation'

const AUDIT_TEMPLATES: Record<string, string> = {
  'token.create': 'API token creation',
  'token.update': 'API token configuration update',
  'token.status_update': 'API token status update',
  'token.delete': 'API token deletion',
  'token.delete_batch': 'API token batch deletion',
  'token.key_view': 'API token key access',
  'token.key_view_batch': 'API token batch key access',
  'access_token.generate': 'Created an access token',
  'access_token.revoke': 'Revoked an access token',
  'access_token.rename': 'Renamed an access token',
  'access_token.update': 'Changed access token permissions',
  'user.2fa_setup': 'Started two-factor authentication setup',
  'user.2fa_enable': 'Enabled two-factor authentication',
  'user.2fa_disable_self': 'Disabled two-factor authentication',
  'user.2fa_backup_codes': 'Regenerated two-factor backup codes',
  'user.security_verify': 'Completed security verification',
  'user.password_change': 'Account password change',
  'user.binding_start': 'Account binding request',
  'user.binding_bind': 'Account binding',
  'user.binding_unbind': 'Account unlinking',
  'user.email_binding_resend': 'Email confirmation code resend',

  login: 'Logged in successfully via {{method}}',
  // User management
  'user.create': 'Created user {{username}} (role {{role}})',
  'user.update': 'Updated user {{username}} (ID: {{id}})',
  'user.delete': 'Deleted user {{username}} (ID: {{id}})',
  'user.account_delete': 'Account deletion',
  'user.manage': 'Performed {{action}} on user {{username}} (ID: {{id}})',
  'user.quota_add': 'Increased user quota by {{quota}}',
  'user.quota_subtract': 'Decreased user quota by {{quota}}',
  'user.quota_override': 'Overrode user quota from {{from}} to {{to}}',
  'user.binding_clear': 'Cleared {{bindingType}} binding for user {{username}}',
  'user.2fa_disable': 'Force-disabled two-factor authentication for the user',
  'user.passkey_register': 'Registered a passkey',
  'user.passkey_delete': 'Deleted a passkey',
  'user.topup_complete': 'Completed top-up order for the user',
  'user.reset_passkey': 'Reset the user passkey',
  'user.oauth_unbind': 'Removed an OAuth binding for the user',
  // System settings
  'option.update': 'Updated system setting {{key}}',
  'option.passkey_domains':
    'Updated Passkey domains: removed {{domains}}; affected {{known}}; unknown {{unknown}}',
  'option.passkey_domains_confirmed':
    'Confirmed removal of Passkey domains: {{domains}}; affected {{known}}; unknown {{unknown}}',
  'option.passkey_domains_blocked':
    'Passkey domain change blocked: {{domains}}; affected {{known}}; unknown {{unknown}}',
  'option.passkey_domains_failed': 'Passkey domain update failed',
  'option.payment_compliance': 'Confirmed payment compliance',
  'option.reset_ratio': 'Reset model ratios',
  'option.clear_affinity_cache': 'Cleared channel affinity cache',
  // Custom OAuth
  'custom_oauth.create': 'Created a custom OAuth provider',
  'custom_oauth.update': 'Updated a custom OAuth provider',
  'custom_oauth.delete': 'Deleted a custom OAuth provider',
  // Performance / cache
  'performance.clear_disk_cache': 'Cleared disk cache',
  'performance.gc': 'Triggered garbage collection',
  'performance.clear_logs': 'Cleared log files',
  // Channel
  'channel.create': 'Created channel {{name}} (type {{type}}, count {{count}})',
  'channel.update': 'Updated channel {{name}} (ID: {{id}})',
  'channel.status_update': 'Updated channel status (ID: {{id}})',
  'channel.status_update_batch':
    'Batch updated channel status ({{count}}/{{total}} changed)',
  'channel.delete': 'Deleted channel {{name}} (ID: {{id}})',
  'channel.delete_batch': 'Batch deleted {{count}} channels',
  'channel.delete_disabled': 'Deleted all disabled channels ({{count}})',
  'channel.key_view': 'Viewed channel key {{name}} (ID: {{id}})',
  'channel.tag_disable': 'Disabled channels with tag {{tag}}',
  'channel.tag_enable': 'Enabled channels with tag {{tag}}',
  'channel.tag_edit': 'Edited channels with tag {{tag}}',
  'channel.tag_batch_set': 'Batch set tag for {{count}} channels',
  'channel.copy':
    'Copied channel (source ID: {{sourceId}}) to {{name}} (new ID: {{id}})',
  'channel.multi_key_manage':
    'Multi-key management {{action}} on channel (ID: {{id}})',
  'channel.upstream_apply':
    'Applied upstream model changes to channel (ID: {{id}})',
  'channel.upstream_apply_all':
    'Applied upstream model changes to {{count}} channels',
  // Redemption codes
  'redemption.create':
    'Created {{count}} redemption codes named {{name}} ({{quota}} each)',
  'redemption.update': 'Updated a redemption code',
  'redemption.delete': 'Deleted a redemption code',
  'redemption.delete_invalid': 'Deleted invalid redemption codes',
  // Prefill groups
  'prefill_group.create': 'Created a prefill group',
  'prefill_group.update': 'Updated a prefill group',
  'prefill_group.delete': 'Deleted a prefill group',
  // Vendors
  'vendor.create': 'Created a vendor',
  'vendor.update': 'Updated a vendor',
  'vendor.delete': 'Deleted a vendor',
  // Model metadata
  'model.create': 'Created a model',
  'model.update': 'Updated a model',
  'model.delete': 'Deleted a model',
  'model.sync_upstream': 'Synced upstream models',
  // Deployments
  'deployment.create': 'Created a deployment',
  'deployment.update': 'Updated a deployment',
  'deployment.delete': 'Deleted a deployment',
  // Subscriptions
  'subscription.plan_create': 'Created a subscription plan',
  'subscription.plan_update': 'Updated a subscription plan',
  'subscription.bind': 'Bound a subscription',
  'subscription.user_quota_reset':
    'Administrator reset the quota of subscription plan {{plan_title}} (ID: {{plan_id}})',
  // Logs
  'log.clear': 'Cleared historical logs',
  'log.cleanup_start': 'Log cleanup task started.',
  // Generic middleware fallback
  generic: '{{method}} {{route}}',
}

export function renderAuditContent(
  other:
    | {
        op?: { action?: string; params?: Record<string, unknown> }
        audit_info?: { route?: string; success?: boolean }
      }
    | null
    | undefined,
  t: (key: string, opts?: Record<string, unknown>) => string
): string | null {
  const op = other?.op
  if (!op?.action) return null
  if (
    op.action === 'redemption.delete_batch' ||
    (op.action === 'redemption.delete' &&
      other?.audit_info?.route === '/api/redemption/batch')
  ) {
    if (other?.audit_info?.success === false) {
      return t('Failed to batch delete redemption codes')
    }
    const count = op.params?.count
    if (
      typeof count === 'number' &&
      Number.isSafeInteger(count) &&
      count >= 0
    ) {
      return t('Batch deleted {{count}} redemption codes', { count })
    }
    return t('Batch deleted redemption codes (count not recorded)')
  }
  const template = AUDIT_TEMPLATES[op.action]
  if (!template) return null
  const quotaOperation = buildQuotaAuditOperation(
    op.action,
    op.params ?? {},
    other?.audit_info?.success !== false,
    t
  )
  if (quotaOperation) {
    return `${quotaOperation.summary} · ${quotaOperation.description}`
  }
  const params = { ...op.params }
  return t(template, params)
}
