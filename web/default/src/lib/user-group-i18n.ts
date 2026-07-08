import i18next from 'i18next'

const USER_GROUP_DESC_KEY_PREFIX = 'i18n:'

const LEGACY_GROUP_DESC_KEY_BY_GROUP: Record<string, Record<string, string>> = {
  default: {
    '': 'User group description.default',
    'default': 'User group description.default',
    '智能路由（最便宜可用渠道优先，失败自动 fallback，含 5% 服务费）':
      'User group description.default',
  },
}

export function resolveUserGroupDescription(
  group: string,
  desc?: string | null
): string {
  const rawDesc = typeof desc === 'string' ? desc.trim() : ''
  const key = resolveUserGroupDescriptionKey(group, rawDesc)

  if (key && i18next.exists(key)) {
    return i18next.t(key)
  }

  if (rawDesc) {
    return rawDesc
  }

  return group
}

function resolveUserGroupDescriptionKey(
  group: string,
  desc: string
): string | null {
  if (desc.startsWith(USER_GROUP_DESC_KEY_PREFIX)) {
    return desc.slice(USER_GROUP_DESC_KEY_PREFIX.length).trim() || null
  }

  if (desc && i18next.exists(desc)) {
    return desc
  }

  return LEGACY_GROUP_DESC_KEY_BY_GROUP[group]?.[desc] ?? null
}

