import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

type Lang = 'en' | 'zh'

const translations: Record<Lang, Record<string, string>> = {
  en: {
    // Nav
    'nav.models': 'Models',
    'nav.docs': 'Docs',
    'nav.pricing': 'Pricing',
    'nav.console': 'Console',

    // Hero
    'hero.eyebrow': 'AI Model API Hub',
    'hero.title': 'One API,',
    'hero.title.accent': 'all frontier models.',
    'hero.lead': 'A unified OpenAI-compatible endpoint for GPT, Claude, Gemini, and more. One integration, every model.',
    'hero.cta.primary': 'Get API Key',
    'hero.cta.secondary': 'Read the docs',
    'hero.routing': 'Routing',

    // Metrics
    'metric.1.value': '34+',
    'metric.1.label': 'Online text models',
    'metric.2.value': '/v1',
    'metric.2.label': 'OpenAI-compatible',
    'metric.3.value': '4',
    'metric.3.label': 'Model families',
    'metric.4.value': 'Docs',
    'metric.4.label': 'Public developer docs',

    // Models
    'models.eyebrow': 'Model hub',
    'models.title': 'Use the model you need without rebuilding integrations.',
    'models.desc': 'Vynex routes major model families behind one predictable API shape, so teams can test and switch models from the console.',
    'models.gpt.title': 'GPT',
    'models.gpt.desc': 'Reasoning, coding, tool calls, and general assistants.',
    'models.claude.title': 'Claude',
    'models.claude.desc': 'Long-form reasoning, writing, analysis, and agents.',
    'models.gemini.title': 'Gemini',
    'models.gemini.desc': 'Multimodal-ready models for structured production flows.',
    'models.open.title': 'Open',
    'models.open.desc': 'Cost-effective open model routes for common workloads.',

    // Workflow
    'workflow.eyebrow': 'API workflow',
    'workflow.title': 'One token, one base URL, every supported model.',
    'workflow.desc': 'Keep your existing OpenAI SDK and choose the upstream model through the model parameter.',
    'workflow.step1.title': 'Create a token',
    'workflow.step1.desc': 'Generate one API key in the console and scope it by usage.',
    'workflow.step2.title': 'Set the base URL',
    'workflow.step2.desc': 'Point your SDK to the OpenAI-compatible /v1 endpoint.',
    'workflow.step3.title': 'Route by model name',
    'workflow.step3.desc': 'Switch upstream models by changing only the model field.',

    // Dev links
    'dev.eyebrow': 'Developer entry points',
    'dev.title': 'Everything needed to ship requests is visible to visitors.',
    'dev.desc': 'Public docs show the API surface and examples, while signed-in users manage keys and test calls from the console.',
    'dev.docs.title': 'API Documentation',
    'dev.docs.desc': 'Browse endpoints, model examples, and request formats.',
    'dev.console.title': 'Console',
    'dev.console.desc': 'Manage keys, balance, usage logs, and routing settings.',
    'dev.playground.title': 'Playground',
    'dev.playground.desc': 'Test chat completions before moving requests into code.',

    // CTA
    'cta.title': 'Launch AI features without integrating every upstream provider.',
    'cta.desc': 'Use {brand} as the stable access layer for model testing, routing, and production calls.',
    'cta.primary': 'Get API Key',
    'cta.secondary': 'Read Documentation',

    // Footer
    'footer.docs': 'Docs',
    'footer.pricing': 'Pricing',
    'footer.console': 'Console',

    // Playground
    'playground.title': 'Playground',
    'playground.model': 'Model',
    'playground.placeholder': 'Type a message...',
    'playground.send': 'Send',

    // Pricing
    'pricing.title': 'Pricing',
    'pricing.model': 'Model',
    'pricing.input': 'Input Price',
    'pricing.output': 'Output Price',
    'pricing.group': 'Group Ratio',

    // About
    'about.title': 'About',

    // Settings
    'settings.title': 'Settings',
    'settings.site': 'Site',
    'settings.auth': 'Auth',
    'settings.billing': 'Billing',
    'settings.content': 'Content',
    'settings.models': 'Models',
    'settings.operations': 'Operations',
    'settings.security': 'Security',
    'settings.save': 'Save',

    // Not Found
    'notFound.title': 'Page not found',
    'notFound.message': 'The page you are looking for does not exist or has been moved.',
    'notFound.home': 'Back to Home',

    // Console Navigation
    'nav.dashboard': 'Dashboard',
    'nav.keys': 'API Keys',
    'nav.wallet': 'Wallet',
    'nav.usageLogs': 'Usage Logs',
    'nav.playground': 'Playground',
    'nav.subscriptions': 'Subscriptions',
    'nav.profile': 'Profile',
    'nav.channels': 'Channels',
    'nav.users': 'Users',
    'nav.redemptions': 'Redemption Codes',
    'nav.settings': 'Settings',
    'nav.logout': 'Logout',
    'nav.userSection': 'Console',
    'nav.adminSection': 'Admin',
    'nav.rootSection': 'System',

    // Dashboard
    'dashboard.title': 'Dashboard',
    'dashboard.totalQuota': 'Total Quota',
    'dashboard.usedQuota': 'Used Quota',
    'dashboard.requests': 'Requests',
    'dashboard.recentLogs': 'Recent Logs',

    // Keys
    'keys.title': 'API Keys',
    'keys.create': 'Create Key',
    'keys.name': 'Name',
    'keys.key': 'Key',
    'keys.status': 'Status',
    'keys.quota': 'Quota',
    'keys.actions': 'Actions',
    'keys.delete': 'Delete',
    'keys.copy': 'Copy',

    // Wallet
    'wallet.title': 'Wallet',
    'wallet.balance': 'Current Balance',
    'wallet.topUp': 'Top Up',
    'wallet.history': 'Top-Up History',
    'wallet.affCode': 'Affiliate',

    // Logs
    'logs.title': 'Usage Logs',
    'logs.time': 'Time',
    'logs.model': 'Model',
    'logs.token': 'Token',
    'logs.quota': 'Quota',
    'logs.channel': 'Channel',

    // Profile
    'profile.title': 'Profile',
    'profile.displayName': 'Display Name',
    'profile.changePassword': 'Change Password',
    'profile.save': 'Save Changes',
    'profile.2fa': 'Two-Factor Auth',
    'profile.passkey': 'Passkey',

    // Subscriptions
    'subs.title': 'Subscriptions',
    'subs.plans': 'Available Plans',
    'subs.active': 'Active Subscriptions',
    'subs.purchase': 'Purchase',

    // Auth
    'auth.signIn.title': 'Sign In',
    'auth.signIn.submit': 'Sign In',
    'auth.signIn.noAccount': "Don't have an account?",
    'auth.signIn.forgotPassword': 'Forgot password?',
    'auth.register.title': 'Create Account',
    'auth.register.submit': 'Register',
    'auth.register.hasAccount': 'Already have an account?',
    'auth.register.verificationSent': 'Verification email sent. Please check your inbox.',
    'auth.forgotPassword.title': 'Reset Password',
    'auth.forgotPassword.submit': 'Send Reset Link',
    'auth.forgotPassword.success': 'Reset link sent to your email.',
    'auth.forgotPassword.backToSignIn': 'Back to Sign In',
    'auth.resetPassword.title': 'Set New Password',
    'auth.resetPassword.submit': 'Reset Password',
    'auth.resetPassword.success': 'Password reset successfully. Redirecting to sign in...',
    'auth.username': 'Username',
    'auth.password': 'Password',
    'auth.confirmPassword': 'Confirm Password',
    'auth.email': 'Email (optional)',
    'auth.2faCode': '2FA Code',
    'auth.2faRequired': 'Two-factor authentication required',
    'auth.registerSuccess': 'Account created successfully!',
    'auth.or': 'or',

    // Channels
    'channels.title': 'Channels',
    'channels.create': 'Add Channel',
    'channels.edit': 'Edit Channel',
    'channels.test': 'Test',
    'channels.balance': 'Balance',
    'channels.delete': 'Delete',
    'channels.name': 'Name',
    'channels.type': 'Type',
    'channels.status': 'Status',
    'channels.models': 'Models',
    'channels.baseUrl': 'Base URL',
    'channels.key': 'API Key',
    'channels.weight': 'Weight',
    'channels.priority': 'Priority',
    'channels.group': 'Group',
    'channels.testResult': 'Response Time',
    'channels.updateBalance': 'Update Balance',

    // Users
    'users.title': 'Users',
    'users.create': 'Add User',
    'users.edit': 'Edit User',
    'users.role': 'Role',
    'users.quota': 'Quota',
    'users.status': 'Status',
    'users.delete': 'Delete',
    'users.search': 'Search users...',

    // Models
    'models.pageTitle': 'Models',
    'models.create': 'Add Model',
    'models.edit': 'Edit Model',
    'models.vendor': 'Vendor',
    'models.inputPrice': 'Input Price',
    'models.outputPrice': 'Output Price',
    'models.enabled': 'Enabled',
    'models.modelId': 'Model ID',

    // Redemptions
    'redemptions.title': 'Redemption Codes',
    'redemptions.create': 'Create Codes',
    'redemptions.key': 'Code',
    'redemptions.quota': 'Quota',
    'redemptions.status': 'Status',
    'redemptions.delete': 'Delete',
    'redemptions.deleteInvalid': 'Delete All Invalid',
    'redemptions.count': 'Count',

    // Common
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.confirm': 'Confirm',
    'common.deleteConfirm': 'Are you sure you want to delete this?',
    'common.loading': 'Loading...',
    'common.error': 'An error occurred',
    'common.noData': 'No data',
    'common.search': 'Search...',
    'common.enabled': 'Enabled',
    'common.disabled': 'Disabled',
    'common.active': 'Active',
    'common.expired': 'Expired',
    'common.unlimited': 'Unlimited',
    'common.all': 'All',
    'common.page': 'Page',
    'common.of': 'of',
    'common.total': 'Total',
  },
  zh: {
    // Nav
    'nav.models': '模型',
    'nav.docs': '文档',
    'nav.pricing': '定价',
    'nav.console': '控制台',

    // Hero
    'hero.eyebrow': 'AI 模型 API 中心',
    'hero.title': '一个 API，',
    'hero.title.accent': '调用所有前沿模型。',
    'hero.lead': '为 GPT、Claude、Gemini 等前沿模型提供统一的 OpenAI 兼容接口。一次接入，全部模型。',
    'hero.cta.primary': '获取 API Key',
    'hero.cta.secondary': '阅读文档',
    'hero.routing': '路由',

    // Metrics
    'metric.1.value': '34+',
    'metric.1.label': '在线文本模型',
    'metric.2.value': '/v1',
    'metric.2.label': 'OpenAI 兼容',
    'metric.3.value': '4',
    'metric.3.label': '模型家族',
    'metric.4.value': '文档',
    'metric.4.label': '公开开发者文档',

    // Models
    'models.eyebrow': '模型中心',
    'models.title': '按需选用模型，无需重复对接。',
    'models.desc': 'Vynex 将主流模型家族统一到一个可预测的 API 形态下，团队可在控制台中测试和切换模型。',
    'models.gpt.title': 'GPT',
    'models.gpt.desc': '推理、编码、工具调用和通用助手。',
    'models.claude.title': 'Claude',
    'models.claude.desc': '长文推理、写作、分析和 Agent。',
    'models.gemini.title': 'Gemini',
    'models.gemini.desc': '支持多模态的结构化生产流程模型。',
    'models.open.title': '开源',
    'models.open.desc': '高性价比开源模型路由，适用于常见工作负载。',

    // Workflow
    'workflow.eyebrow': '接入流程',
    'workflow.title': '一个 Token，一个 Base URL，全部模型。',
    'workflow.desc': '保留现有 OpenAI SDK，通过 model 参数选择上游模型即可。',
    'workflow.step1.title': '创建 Token',
    'workflow.step1.desc': '在控制台生成 API Key，按用量限定范围。',
    'workflow.step2.title': '设置 Base URL',
    'workflow.step2.desc': '将 SDK 指向 OpenAI 兼容的 /v1 端点。',
    'workflow.step3.title': '按模型名路由',
    'workflow.step3.desc': '只需切换 model 字段即可调用不同上游模型。',

    // Dev links
    'dev.eyebrow': '开发者入口',
    'dev.title': '访客即可看到发布请求所需的全部信息。',
    'dev.desc': '公开文档展示 API 接口和示例，登录用户可在控制台管理密钥和测试调用。',
    'dev.docs.title': 'API 文档',
    'dev.docs.desc': '浏览接口、模型示例和请求格式。',
    'dev.console.title': '控制台',
    'dev.console.desc': '管理密钥、余额、用量日志和路由设置。',
    'dev.playground.title': 'Playground',
    'dev.playground.desc': '在编写代码前测试 Chat Completions 调用。',

    // CTA
    'cta.title': '无需逐一对接上游供应商，即可上线 AI 功能。',
    'cta.desc': '将 {brand} 作为模型测试、路由和生产调用的稳定接入层。',
    'cta.primary': '获取 API Key',
    'cta.secondary': '阅读文档',

    // Footer
    'footer.docs': '文档',
    'footer.pricing': '定价',
    'footer.console': '控制台',

    // Playground
    'playground.title': 'Playground',
    'playground.model': '模型',
    'playground.placeholder': '输入消息...',
    'playground.send': '发送',

    // Pricing
    'pricing.title': '定价',
    'pricing.model': '模型',
    'pricing.input': '输入价格',
    'pricing.output': '输出价格',
    'pricing.group': '分组倍率',

    // About
    'about.title': '关于',

    // Settings
    'settings.title': '系统设置',
    'settings.site': '站点',
    'settings.auth': '认证',
    'settings.billing': '计费',
    'settings.content': '内容',
    'settings.models': '模型',
    'settings.operations': '运维',
    'settings.security': '安全',
    'settings.save': '保存',

    // Not Found
    'notFound.title': '页面未找到',
    'notFound.message': '您访问的页面不存在或已被移动。',
    'notFound.home': '返回首页',

    // Console Navigation
    'nav.dashboard': '仪表盘',
    'nav.keys': 'API 密钥',
    'nav.wallet': '钱包',
    'nav.usageLogs': '用量日志',
    'nav.playground': 'Playground',
    'nav.subscriptions': '订阅',
    'nav.profile': '个人资料',
    'nav.channels': '渠道',
    'nav.users': '用户',
    'nav.redemptions': '兑换码',
    'nav.settings': '系统设置',
    'nav.logout': '退出登录',
    'nav.userSection': '控制台',
    'nav.adminSection': '管理',
    'nav.rootSection': '系统',

    // Dashboard
    'dashboard.title': '仪表盘',
    'dashboard.totalQuota': '总配额',
    'dashboard.usedQuota': '已用配额',
    'dashboard.requests': '请求数',
    'dashboard.recentLogs': '近期日志',

    // Keys
    'keys.title': 'API 密钥',
    'keys.create': '创建密钥',
    'keys.name': '名称',
    'keys.key': '密钥',
    'keys.status': '状态',
    'keys.quota': '配额',
    'keys.actions': '操作',
    'keys.delete': '删除',
    'keys.copy': '复制',

    // Wallet
    'wallet.title': '钱包',
    'wallet.balance': '当前余额',
    'wallet.topUp': '充值',
    'wallet.history': '充值记录',
    'wallet.affCode': '推广',

    // Logs
    'logs.title': '用量日志',
    'logs.time': '时间',
    'logs.model': '模型',
    'logs.token': '令牌',
    'logs.quota': '配额',
    'logs.channel': '渠道',

    // Profile
    'profile.title': '个人资料',
    'profile.displayName': '显示名称',
    'profile.changePassword': '修改密码',
    'profile.save': '保存更改',
    'profile.2fa': '两步验证',
    'profile.passkey': '通行密钥',

    // Subscriptions
    'subs.title': '订阅',
    'subs.plans': '可用方案',
    'subs.active': '当前订阅',
    'subs.purchase': '购买',

    // Auth
    'auth.signIn.title': '登录',
    'auth.signIn.submit': '登录',
    'auth.signIn.noAccount': '还没有账号？',
    'auth.signIn.forgotPassword': '忘记密码？',
    'auth.register.title': '注册账号',
    'auth.register.submit': '注册',
    'auth.register.hasAccount': '已有账号？',
    'auth.register.verificationSent': '验证邮件已发送，请查收邮箱。',
    'auth.forgotPassword.title': '重置密码',
    'auth.forgotPassword.submit': '发送重置链接',
    'auth.forgotPassword.success': '重置链接已发送至您的邮箱。',
    'auth.forgotPassword.backToSignIn': '返回登录',
    'auth.resetPassword.title': '设置新密码',
    'auth.resetPassword.submit': '重置密码',
    'auth.resetPassword.success': '密码重置成功，正在跳转到登录页...',
    'auth.username': '用户名',
    'auth.password': '密码',
    'auth.confirmPassword': '确认密码',
    'auth.email': '邮箱（可选）',
    'auth.2faCode': '两步验证码',
    'auth.2faRequired': '需要两步验证',
    'auth.registerSuccess': '账号创建成功！',
    'auth.or': '或',

    // Channels
    'channels.title': '渠道',
    'channels.create': '添加渠道',
    'channels.edit': '编辑渠道',
    'channels.test': '测试',
    'channels.balance': '余额',
    'channels.delete': '删除',
    'channels.name': '名称',
    'channels.type': '类型',
    'channels.status': '状态',
    'channels.models': '模型',
    'channels.baseUrl': 'Base URL',
    'channels.key': 'API Key',
    'channels.weight': '权重',
    'channels.priority': '优先级',
    'channels.group': '分组',
    'channels.testResult': '响应时间',
    'channels.updateBalance': '更新余额',

    // Users
    'users.title': '用户',
    'users.create': '添加用户',
    'users.edit': '编辑用户',
    'users.role': '角色',
    'users.quota': '配额',
    'users.status': '状态',
    'users.delete': '删除',
    'users.search': '搜索用户...',

    // Models
    'models.pageTitle': '模型',
    'models.create': '添加模型',
    'models.edit': '编辑模型',
    'models.vendor': '供应商',
    'models.inputPrice': '输入价格',
    'models.outputPrice': '输出价格',
    'models.enabled': '已启用',
    'models.modelId': '模型 ID',

    // Redemptions
    'redemptions.title': '兑换码',
    'redemptions.create': '创建兑换码',
    'redemptions.key': '兑换码',
    'redemptions.quota': '配额',
    'redemptions.status': '状态',
    'redemptions.delete': '删除',
    'redemptions.deleteInvalid': '删除所有无效码',
    'redemptions.count': '数量',

    // Common
    'common.save': '保存',
    'common.cancel': '取消',
    'common.confirm': '确认',
    'common.deleteConfirm': '确定要删除吗？',
    'common.loading': '加载中...',
    'common.error': '发生错误',
    'common.noData': '暂无数据',
    'common.search': '搜索...',
    'common.enabled': '已启用',
    'common.disabled': '已禁用',
    'common.active': '有效',
    'common.expired': '已过期',
    'common.unlimited': '无限制',
    'common.all': '全部',
    'common.page': '第',
    'common.of': '页，共',
    'common.total': '条',
  },
}

type I18nContextValue = {
  lang: Lang
  t: (key: string, vars?: Record<string, string>) => string
  toggle: () => void
  label: string
}

const I18nContext = createContext<I18nContextValue>({
  lang: 'en',
  t: (k) => k,
  toggle: () => {},
  label: 'EN',
})

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('vynex-lang') : null
    if (saved === 'zh' || saved === 'en') return saved
    const browser = navigator.language.toLowerCase()
    return browser.startsWith('zh') ? 'zh' : 'en'
  })

  const toggle = useCallback(() => {
    setLang((prev) => {
      const next = prev === 'en' ? 'zh' : 'en'
      localStorage.setItem('vynex-lang', next)
      return next
    })
  }, [])

  const t = useCallback(
    (key: string, vars?: Record<string, string>) => {
      let text = translations[lang][key] || translations.en[key] || key
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          text = text.replace(`{${k}}`, v)
        }
      }
      return text
    },
    [lang],
  )

  return (
    <I18nContext.Provider value={{ lang, t, toggle, label: lang === 'en' ? '中' : 'EN' }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  return useContext(I18nContext)
}
