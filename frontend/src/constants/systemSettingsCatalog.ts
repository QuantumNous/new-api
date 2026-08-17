import type { SystemSettingValue } from '@/composables/useSystemSettings'

export type SystemSettingsDomainId =
  | 'site'
  | 'auth'
  | 'billing'
  | 'models'
  | 'security'
  | 'content'
  | 'operations'

export type SystemSettingFieldKind =
  | 'boolean'
  | 'number'
  | 'text'
  | 'url'
  | 'secret'
  | 'secret-textarea'
  | 'textarea'
  | 'json'
  | 'list'
  | 'key-value'
  | 'ratio'
  | 'select'

export interface SystemSettingField {
  key: string
  label: string
  description?: string
  kind: SystemSettingFieldKind
  defaultValue: SystemSettingValue
  options?: ReadonlyArray<{ value: string; label: string }>
}

export interface SystemSettingsSection {
  id: string
  title: string
  description: string
  fields: readonly SystemSettingField[]
  integration?:
    | 'custom-oauth'
    | 'performance'
    | 'channel-affinity'
    | 'waffo-pancake'
}

export interface SystemSettingsDomain {
  id: SystemSettingsDomainId
  titleKey: string
  defaultSection: string
  sections: readonly SystemSettingsSection[]
}

const text = (
  key: string,
  label: string,
  defaultValue = '',
  description?: string
): SystemSettingField => ({ key, label, description, kind: 'text', defaultValue })
const url = (
  key: string,
  label: string,
  description?: string
): SystemSettingField => ({ key, label, description, kind: 'url', defaultValue: '' })
const secret = (
  key: string,
  label: string,
  description?: string
): SystemSettingField => ({ key, label, description, kind: 'secret', defaultValue: '' })
const secretTextarea = (
  key: string,
  label: string,
  description?: string
): SystemSettingField => ({
  key,
  label,
  description,
  kind: 'secret-textarea',
  defaultValue: '',
})
const number = (
  key: string,
  label: string,
  defaultValue = 0,
  description?: string
): SystemSettingField => ({ key, label, description, kind: 'number', defaultValue })
const toggle = (
  key: string,
  label: string,
  defaultValue = false,
  description?: string
): SystemSettingField => ({ key, label, description, kind: 'boolean', defaultValue })
const textarea = (
  key: string,
  label: string,
  description?: string
): SystemSettingField => ({ key, label, description, kind: 'textarea', defaultValue: '' })
const json = (
  key: string,
  label: string,
  defaultValue = '{}',
  description?: string
): SystemSettingField => ({ key, label, description, kind: 'json', defaultValue })
const list = (
  key: string,
  label: string,
  defaultValue = '[]',
  description?: string
): SystemSettingField => ({ key, label, description, kind: 'list', defaultValue })
const keyValue = (
  key: string,
  label: string,
  defaultValue = '{}',
  description?: string
): SystemSettingField => ({ key, label, description, kind: 'key-value', defaultValue })
const ratio = (
  key: string,
  label: string,
  defaultValue = '{}',
  description?: string
): SystemSettingField => ({ key, label, description, kind: 'ratio', defaultValue })
const select = (
  key: string,
  label: string,
  defaultValue: string,
  options: ReadonlyArray<{ value: string; label: string }>,
  description?: string
): SystemSettingField => ({ key, label, description, kind: 'select', defaultValue, options })

export const SYSTEM_SETTINGS_DOMAINS: readonly SystemSettingsDomain[] = [
  {
    id: 'site',
    titleKey: 'systemSettings.tabs.site',
    defaultSection: 'system-info',
    sections: [
      {
        id: 'system-info',
        title: '系统信息',
        description: '站点名称、公开地址、品牌内容与法律文本。',
        fields: [
          text('SystemName', '系统名称'),
          url('ServerAddress', '服务器地址', '用于 OAuth 回调、Webhook 与外部集成。'),
          url('Logo', 'Logo 地址'),
          textarea('Footer', '页脚内容'),
          textarea('About', '关于页面内容'),
          textarea('HomePageContent', '首页内容'),
          textarea('legal.user_agreement', '用户协议'),
          textarea('legal.privacy_policy', '隐私政策'),
        ],
      },
      {
        id: 'notice',
        title: '系统公告',
        description: '控制台公告和用户可见提醒。',
        fields: [textarea('Notice', '公告内容')],
      },
      {
        id: 'navigation',
        title: '导航模块',
        description: '控制首页顶部模块和管理员侧栏的可见导航。',
        fields: [
          json('HeaderNavModules', '顶部导航模块', '[]'),
          json('SidebarModulesAdmin', '管理员侧栏模块', '[]'),
        ],
      },
    ],
  },
  {
    id: 'auth',
    titleKey: 'systemSettings.tabs.auth',
    defaultSection: 'basic-auth',
    sections: [
      {
        id: 'basic-auth',
        title: '基础认证',
        description: '注册、密码登录与邮箱注册策略。',
        fields: [
          toggle('PasswordLoginEnabled', '允许密码登录', true),
          toggle('RegisterEnabled', '开放注册', true),
          toggle('PasswordRegisterEnabled', '允许密码注册', true),
          toggle('EmailVerificationEnabled', '要求邮箱验证'),
          toggle('EmailDomainRestrictionEnabled', '限制注册邮箱域名'),
          toggle('EmailAliasRestrictionEnabled', '禁止邮箱别名'),
          textarea('EmailDomainWhitelist', '邮箱域名白名单', '以逗号或换行分隔。'),
        ],
      },
      {
        id: 'oauth',
        title: 'OAuth 集成',
        description: '内置第三方登录提供商与回调配置。',
        fields: [
          toggle('GitHubOAuthEnabled', '启用 GitHub 登录'),
          text('GitHubClientId', 'GitHub Client ID'),
          secret('GitHubClientSecret', 'GitHub Client Secret'),
          toggle('LinuxDOOAuthEnabled', '启用 LinuxDO 登录'),
          text('LinuxDOClientId', 'LinuxDO Client ID'),
          secret('LinuxDOClientSecret', 'LinuxDO Client Secret'),
          number('LinuxDOMinimumTrustLevel', 'LinuxDO 最低信任等级', 0),
          toggle('discord.enabled', '启用 Discord 登录'),
          text('discord.client_id', 'Discord Client ID'),
          secret('discord.client_secret', 'Discord Client Secret'),
          toggle('TelegramOAuthEnabled', '启用 Telegram 登录'),
          secret('TelegramBotToken', 'Telegram Bot Token'),
          text('TelegramBotName', 'Telegram Bot 用户名'),
          toggle('WeChatAuthEnabled', '启用微信登录'),
          url('WeChatServerAddress', '微信服务地址'),
          secret('WeChatServerToken', '微信服务 Token'),
          url('WeChatAccountQRCodeImageURL', '微信二维码图片地址'),
          toggle('oidc.enabled', '启用 OIDC 登录'),
          text('oidc.display_name', 'OIDC 显示名称'),
          text('oidc.client_id', 'OIDC Client ID'),
          secret('oidc.client_secret', 'OIDC Client Secret'),
          url('oidc.well_known', 'OIDC Well-Known 地址'),
          url('oidc.authorization_endpoint', 'OIDC 授权端点'),
          url('oidc.token_endpoint', 'OIDC Token 端点'),
          url('oidc.user_info_endpoint', 'OIDC 用户信息端点'),
        ],
      },
      {
        id: 'passkey',
        title: 'Passkey',
        description: 'WebAuthn 依赖方与验证策略。',
        fields: [
          toggle('passkey.enabled', '启用 Passkey'),
          text('passkey.rp_display_name', '依赖方显示名称'),
          text('passkey.rp_id', '依赖方 ID'),
          textarea('passkey.origins', '允许来源'),
          toggle('passkey.allow_insecure_origin', '允许不安全来源'),
          select('passkey.user_verification', '用户验证要求', 'preferred', [
            { value: 'required', label: '必须' },
            { value: 'preferred', label: '优先' },
            { value: 'discouraged', label: '不要求' },
          ]),
          select('passkey.attachment_preference', '认证器偏好', '', [
            { value: '', label: '不限制' },
            { value: 'platform', label: '平台认证器' },
            { value: 'cross-platform', label: '跨平台认证器' },
          ]),
        ],
      },
      {
        id: 'bot-protection',
        title: 'Bot 防护',
        description: 'Cloudflare Turnstile 验证。',
        fields: [
          toggle('TurnstileCheckEnabled', '启用 Turnstile'),
          text('TurnstileSiteKey', 'Turnstile Site Key'),
          secret('TurnstileSecretKey', 'Turnstile Secret Key'),
        ],
      },
      {
        id: 'custom-oauth',
        title: '自定义 OAuth',
        description: '通过下方提供商管理面板维护自定义 OAuth/OIDC 登录。',
        fields: [],
        integration: 'custom-oauth',
      },
    ],
  },
  {
    id: 'billing',
    titleKey: 'systemSettings.tabs.billing',
    defaultSection: 'quota',
    sections: [
      {
        id: 'quota',
        title: '配额与展示',
        description: '注册、邀请、充值入口和货币展示规则。',
        fields: [
          number('QuotaForNewUser', '新用户初始配额'),
          number('PreConsumedQuota', '请求预扣配额', 500000),
          number('QuotaForInviter', '邀请人奖励'),
          number('QuotaForInvitee', '被邀请人奖励'),
          url('TopUpLink', '外部充值链接'),
          url('general_setting.docs_link', '文档链接'),
          toggle('quota_setting.enable_free_model_pre_consume', '免费模型预扣配额'),
          number('QuotaPerUnit', '每单位配额', 500000),
          number('USDExchangeRate', '美元汇率', 1),
          toggle('DisplayInCurrencyEnabled', '以货币显示配额'),
          toggle('DisplayTokenStatEnabled', '显示 Token 统计'),
          select('general_setting.quota_display_type', '配额显示类型', 'quota', [
            { value: 'quota', label: '配额' },
            { value: 'USD', label: '美元' },
            { value: 'TOKENS', label: 'Token' },
            { value: 'custom', label: '自定义货币' },
          ]),
          text('general_setting.custom_currency_symbol', '自定义货币符号', '¤'),
          number('general_setting.custom_currency_exchange_rate', '自定义货币汇率', 1),
        ],
      },
      {
        id: 'pricing',
        title: '模型与分组定价',
        description: '所有倍率字段均使用受校验的结构化 JSON 编辑器。',
        fields: [
          ratio('ModelPrice', '模型价格'),
          ratio('ModelRatio', '模型倍率'),
          ratio('CompletionRatio', '补全倍率'),
          ratio('CacheRatio', '缓存倍率'),
          ratio('CreateCacheRatio', '缓存创建倍率'),
          ratio('ImageRatio', '图像倍率'),
          ratio('AudioRatio', '音频倍率'),
          ratio('AudioCompletionRatio', '音频补全倍率'),
          ratio('TopupGroupRatio', '充值分组倍率'),
          ratio('GroupRatio', '分组倍率'),
          json('GroupGroupRatio', '组间倍率'),
          list('UserUsableGroups', '用户可用分组', '[]'),
          json('AutoGroups', '自动分组规则', '[]'),
          number('MaxTokenAutoGroups', '自动分组 Token 阈值'),
          toggle('DefaultUseAutoGroup', '默认使用自动分组'),
          toggle('ExposeRatioEnabled', '公开倍率数据'),
          json('tool_price_setting.prices', '工具附加价格', '[]'),
        ],
      },
      {
        id: 'payment',
        title: '支付网关',
        description: '所有凭据仅支持更新，保存后不会回传。',
        fields: [
          url('PayAddress', '易支付地址'),
          text('EpayId', '易支付商户 ID'),
          secret('EpayKey', '易支付密钥'),
          number('Price', '基础价格', 7.3),
          number('MinTopUp', '最低充值金额', 1),
          url('CustomCallbackAddress', '支付回调地址'),
          json('PayMethods', '易支付支付方式', '[]'),
          secret('StripeApiSecret', 'Stripe API Secret'),
          secret('StripeWebhookSecret', 'Stripe Webhook Secret'),
          text('StripePriceId', 'Stripe Price ID'),
          number('StripeUnitPrice', 'Stripe 单位价格', 1),
          number('StripeMinTopUp', 'Stripe 最低充值', 1),
          toggle('StripePromotionCodesEnabled', '启用 Stripe 优惠码'),
          secret('CreemApiKey', 'Creem API Key'),
          secret('CreemWebhookSecret', 'Creem Webhook Secret'),
          toggle('CreemTestMode', 'Creem 测试模式'),
          json('CreemProducts', 'Creem 产品配置', '[]'),
          toggle('WaffoEnabled', '启用 Waffo'),
          secret('WaffoApiKey', 'Waffo API Key'),
          secret('WaffoPrivateKey', 'Waffo 私钥'),
          secretTextarea('WaffoPublicCert', 'Waffo 公钥证书'),
          toggle('WaffoSandbox', 'Waffo 沙箱模式'),
          text('WaffoMerchantId', 'Waffo 商户 ID'),
          text('WaffoCurrency', 'Waffo 货币', 'USD'),
          number('WaffoUnitPrice', 'Waffo 单位价格', 1),
          number('WaffoMinTopUp', 'Waffo 最低充值', 1),
          url('WaffoNotifyUrl', 'Waffo 通知地址'),
          url('WaffoReturnUrl', 'Waffo 返回地址'),
          json('WaffoPayMethods', 'Waffo 支付方式', '[]'),
        ],
      },
      {
        id: 'waffo-pancake',
        title: 'Waffo Pancake',
        description: '验证凭据、选择店铺与产品后，通过网关专用接口原子保存。',
        fields: [],
        integration: 'waffo-pancake',
      },
      {
        id: 'checkin',
        title: '签到奖励',
        description: '每日签到的随机配额范围。',
        fields: [
          toggle('checkin_setting.enabled', '启用每日签到'),
          number('checkin_setting.min_quota', '最小奖励', 100),
          number('checkin_setting.max_quota', '最大奖励', 500),
        ],
      },
    ],
  },
  {
    id: 'models',
    titleKey: 'systemSettings.tabs.models',
    defaultSection: 'routing',
    sections: [
      {
        id: 'routing',
        title: '路由可靠性',
        description: '上游重试、禁用与自动恢复规则。',
        fields: [
          number('RetryTimes', '请求重试次数'),
          number('ChannelDisableThreshold', '自动禁用阈值', 5),
          toggle('AutomaticDisableChannelEnabled', '自动禁用渠道'),
          toggle('AutomaticEnableChannelEnabled', '自动恢复渠道'),
          textarea('AutomaticDisableKeywords', '自动禁用关键词'),
          textarea('AutomaticDisableStatusCodes', '自动禁用状态码范围'),
          textarea('AutomaticRetryStatusCodes', '自动重试状态码范围'),
          toggle('monitor_setting.auto_test_channel_enabled', '自动测试渠道'),
          number('monitor_setting.auto_test_channel_minutes', '自动测试间隔（分钟）', 60),
          toggle('global.pass_through_request_enabled', '透传请求模式'),
          toggle('general_setting.ping_interval_enabled', '启用心跳检测'),
          number('general_setting.ping_interval_seconds', '心跳间隔（秒）', 60),
        ],
      },
      {
        id: 'affinity',
        title: '渠道亲和性',
        description: '同一用户优先复用成功渠道，并可查看或清空缓存。',
        fields: [
          toggle('channel_affinity_setting.enabled', '启用渠道亲和性'),
          toggle('channel_affinity_setting.switch_on_success', '成功后更新绑定'),
          number('channel_affinity_setting.default_ttl_seconds', '绑定有效期（秒）', 3600),
        ],
        integration: 'channel-affinity',
      },
      {
        id: 'vendor',
        title: '模型供应商策略',
        description: '供应商专属安全与生成策略。',
        fields: [
          keyValue('gemini.safety_settings', 'Gemini 安全策略'),
          json('claude.default_max_tokens', 'Claude 默认 max_tokens'),
          toggle('claude.thinking_adapter_enabled', 'Claude 思考适配器'),
          json('grok.reasoning_effort', 'Grok 推理强度策略'),
        ],
      },
      {
        id: 'deployment',
        title: '模型部署与自动定价',
        description: 'iONet 部署和自动定价同步参数。',
        fields: [
          toggle('model_deployment.ionet.enabled', '启用 iONet 部署'),
          secret('model_deployment.ionet.api_key', 'iONet API Key'),
          toggle('auto_pricing.enabled', '启用自动定价'),
          url('auto_pricing.remote_url', '自动定价数据地址'),
          url('auto_pricing.hash_url', '自动定价校验地址'),
          toggle('auto_pricing.fuzzy_match_enabled', '启用模糊模型匹配'),
        ],
      },
    ],
  },
  {
    id: 'security',
    titleKey: 'systemSettings.tabs.security',
    defaultSection: 'rate-limit',
    sections: [
      {
        id: 'rate-limit',
        title: '请求限流',
        description: '全局模型请求限流与按分组策略。',
        fields: [
          toggle('ModelRequestRateLimitEnabled', '启用请求限流'),
          number('ModelRequestRateLimitCount', '时间窗口请求上限', 60),
          number('ModelRequestRateLimitSuccessCount', '成功请求上限'),
          number('ModelRequestRateLimitDurationMinutes', '限流窗口（分钟）', 1),
          json('ModelRequestRateLimitGroup', '分组限流规则', '{}'),
        ],
      },
      {
        id: 'sensitive',
        title: '敏感内容',
        description: '请求/响应敏感词检测和处理方式。',
        fields: [
          toggle('CheckSensitiveEnabled', '启用敏感词检测'),
          toggle('CheckSensitiveOnPromptEnabled', '检测用户 Prompt'),
          toggle('StopOnSensitiveEnabled', '命中后立即停止生成', true),
          textarea('SensitiveWords', '敏感词列表'),
          number('StreamCacheQueueLength', '流式缓存队列长度'),
        ],
      },
      {
        id: 'ssrf',
        title: 'SSRF 防护',
        description: '域名、IP 和端口访问规则。',
        fields: [
          toggle('fetch_setting.enable_ssrf_protection', '启用 SSRF 防护', true),
          toggle('fetch_setting.allow_private_ip', '允许私有 IP'),
          toggle('fetch_setting.domain_filter_mode', '域名白名单模式'),
          toggle('fetch_setting.ip_filter_mode', 'IP 白名单模式'),
          list('fetch_setting.domain_list', '域名规则', '[]'),
          list('fetch_setting.ip_list', 'IP / CIDR 规则', '[]'),
          list('fetch_setting.allowed_ports', '允许端口', '["80", "443", "8080", "8443"]'),
          toggle('fetch_setting.apply_ip_filter_for_domain', '对域名解析结果应用 IP 规则', true),
        ],
      },
      {
        id: 'token-limits',
        title: 'Token 限制',
        description: '用户 API Token 创建限制。',
        fields: [number('token_setting.max_user_tokens', '每位用户最大 Token 数')],
      },
    ],
  },
  {
    id: 'content',
    titleKey: 'systemSettings.tabs.content',
    defaultSection: 'dashboard',
    sections: [
      {
        id: 'dashboard',
        title: '数据仪表盘',
        description: '控制数据导出和默认时间范围。',
        fields: [
          toggle('DataExportEnabled', '启用数据导出', true),
          number('DataExportInterval', '数据刷新间隔（分钟）', 5),
          select('DataExportDefaultTime', '默认时间范围', 'hour', [
            { value: 'hour', label: '小时' },
            { value: 'day', label: '天' },
            { value: 'week', label: '周' },
          ]),
        ],
      },
      {
        id: 'console-content',
        title: '控制台内容',
        description: '公告、API 地址、FAQ、可用性面板和聊天预设。',
        fields: [
          toggle('console_setting.announcements_enabled', '显示公告'),
          json('console_setting.announcements', '公告列表', '[]'),
          toggle('console_setting.api_info_enabled', '显示 API 地址'),
          json('console_setting.api_info', 'API 地址列表', '[]'),
          toggle('console_setting.faq_enabled', '显示 FAQ'),
          json('console_setting.faq', 'FAQ 列表', '[]'),
          toggle('console_setting.uptime_kuma_enabled', '显示 Uptime Kuma'),
          json('console_setting.uptime_kuma_groups', 'Uptime Kuma 分组', '[]'),
          json('Chats', '聊天预设', '{}'),
        ],
      },
      {
        id: 'drawing',
        title: '绘图能力',
        description: 'Midjourney 代理功能与回调行为。',
        fields: [
          toggle('DrawingEnabled', '启用绘图'),
          toggle('MjNotifyEnabled', '允许上游回调'),
          toggle('MjAccountFilterEnabled', '允许 accountFilter 参数'),
          toggle('MjForwardUrlEnabled', '重写回调 URL'),
          toggle('MjModeClearEnabled', '清理 Prompt 模式标识'),
          toggle('MjActionCheckSuccessEnabled', '要求任务成功后续操作'),
          toggle('TaskEnabled', '启用任务能力'),
        ],
      },
    ],
  },
  {
    id: 'operations',
    titleKey: 'systemSettings.tabs.operations',
    defaultSection: 'behavior',
    sections: [
      {
        id: 'behavior',
        title: '系统行为',
        description: '控制台默认行为和运营模式。',
        fields: [
          toggle('DefaultCollapseSidebar', '默认折叠侧栏'),
          toggle('DemoSiteEnabled', '演示站模式'),
          toggle('SelfUseModeEnabled', '自用模式'),
          toggle('LogConsumeEnabled', '记录额度消耗日志', true),
        ],
      },
      {
        id: 'email',
        title: 'SMTP 邮件',
        description: '出站邮件服务器和 TLS 策略。',
        fields: [
          text('SMTPServer', 'SMTP 服务器'),
          number('SMTPPort', 'SMTP 端口', 587),
          text('SMTPAccount', 'SMTP 账户'),
          text('SMTPFrom', '发件人'),
          secret('SMTPToken', 'SMTP 密码或访问 Token'),
          toggle('SMTPSSLEnabled', '启用 SSL/TLS'),
          toggle('SMTPStartTLSEnabled', '启用 STARTTLS'),
          toggle('SMTPInsecureSkipVerify', '跳过 TLS 证书校验'),
          toggle('SMTPForceAuthLogin', '强制 AUTH LOGIN'),
        ],
      },
      {
        id: 'monitoring',
        title: '监控与告警',
        description: '用户余额告警和性能指标采集。',
        fields: [
          number('QuotaRemindThreshold', '配额提醒阈值', 1000),
          toggle('perf_metrics_setting.enabled', '启用性能指标', true),
          number('perf_metrics_setting.flush_interval', '指标落盘间隔（分钟）', 5),
          select('perf_metrics_setting.bucket_time', '指标聚合粒度', 'hour', [
            { value: 'minute', label: '分钟' },
            { value: '5min', label: '5 分钟' },
            { value: 'hour', label: '小时' },
          ]),
          number('perf_metrics_setting.retention_days', '指标保留天数'),
        ],
      },
      {
        id: 'worker',
        title: 'Worker 代理',
        description: 'Worker 服务和 HTTP 图片请求策略。',
        fields: [
          url('WorkerUrl', 'Worker URL'),
          secret('WorkerValidKey', 'Worker 验证密钥'),
          toggle('WorkerAllowHttpImageRequestEnabled', '允许 Worker 请求 HTTP 图片'),
        ],
      },
      {
        id: 'performance',
        title: '性能与缓存',
        description: '请求体磁盘缓存和资源阈值保护。',
        fields: [
          toggle('performance_setting.disk_cache_enabled', '启用磁盘缓存'),
          number('performance_setting.disk_cache_threshold_mb', '磁盘缓存阈值（MB）', 10),
          number('performance_setting.disk_cache_max_size_mb', '最大缓存（MB）', 1024),
          text('performance_setting.disk_cache_path', '缓存目录'),
          toggle('performance_setting.monitor_enabled', '启用资源监控'),
          number('performance_setting.monitor_cpu_threshold', 'CPU 阈值（%）', 90),
          number('performance_setting.monitor_memory_threshold', '内存阈值（%）', 90),
          number('performance_setting.monitor_disk_threshold', '磁盘阈值（%）', 95),
        ],
        integration: 'performance',
      },
    ],
  },
]

export function getSystemSettingsDomain(
  id: string
): SystemSettingsDomain | undefined {
  return SYSTEM_SETTINGS_DOMAINS.find((domain) => domain.id === id)
}
