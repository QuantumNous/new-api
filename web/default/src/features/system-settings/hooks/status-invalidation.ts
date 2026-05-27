const STATUS_RELATED_KEYS = [
  'theme.frontend',
  'HeaderNavModules',
  'SidebarModulesAdmin',
  'Notice',
  'console_setting.api_info',
  'console_setting.announcements',
  'console_setting.faq',
  'console_setting.uptime_kuma_groups',
  'console_setting.api_info_enabled',
  'console_setting.announcements_enabled',
  'console_setting.faq_enabled',
  'console_setting.uptime_kuma_enabled',
  'LogConsumeEnabled',
  'QuotaPerUnit',
  'USDExchangeRate',
  'DisplayInCurrencyEnabled',
  'DisplayTokenStatEnabled',
  'general_setting.quota_display_type',
  'general_setting.custom_currency_symbol',
  'general_setting.custom_currency_exchange_rate',
]

export function shouldInvalidateStatusForOption(key: string) {
  return STATUS_RELATED_KEYS.includes(key)
}
