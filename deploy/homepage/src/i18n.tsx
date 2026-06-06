import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

export const languages = [
  { value: 'zh', label: '简体中文' },
  { value: 'en', label: 'English' },
  { value: 'ru', label: 'Русский' },
] as const

export type Lang = (typeof languages)[number]['value']

function isLang(value: string | null): value is Lang {
  return languages.some((item) => item.value === value)
}

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
    'common.baseUrl': 'Base URL',
    'common.key': 'Key',
    'common.group': 'Group',
    'common.weight': 'Weight',
    'common.priority': 'Priority',
    'common.username': 'Username',
    'common.email': 'Email',
    'common.passwordKeepHint': 'leave blank to keep',
    'common.balance': 'Balance',
    'common.usageOverview': 'Usage Overview',
    'common.quotaUsd': 'Quota ($)',
    'common.expiredTime': 'Expired Time',
    'common.neverExpireHint': 'Leave empty for never expire',
    'common.allModelsHint': 'Leave empty for all models',
    'common.affiliateCode': 'Affiliate Code',
    'common.inviteLink': 'Invite Link',
    'common.role': 'Role',
    'common.code': 'Code',
    'common.link': 'Link',
    'common.affiliate': 'Affiliate',
    'common.period': 'Period',
    'common.date': 'Date',
    'common.description': 'Description',
    'common.commaSeparated': 'comma-separated',
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
    'common.baseUrl': 'Base URL',
    'common.key': '密钥',
    'common.group': '分组',
    'common.weight': '权重',
    'common.priority': '优先级',
    'common.username': '用户名',
    'common.email': '邮箱',
    'common.passwordKeepHint': '留空则保持不变',
    'common.balance': '余额',
    'common.usageOverview': '用量概览',
    'common.quotaUsd': '配额（$）',
    'common.expiredTime': '过期时间',
    'common.neverExpireHint': '留空表示永不过期',
    'common.allModelsHint': '留空表示全部模型',
    'common.affiliateCode': '推广码',
    'common.inviteLink': '邀请链接',
    'common.role': '角色',
    'common.code': '代码',
    'common.link': '链接',
    'common.affiliate': '推广',
    'common.period': '周期',
    'common.date': '日期',
    'common.description': '描述',
    'common.commaSeparated': '逗号分隔',
  },
  ru: {
    // Nav
    'nav.models': 'Модели',
    'nav.docs': 'Документация',
    'nav.pricing': 'Цены',
    'nav.console': 'Консоль',

    // Hero
    'hero.eyebrow': 'API-хаб AI-моделей',
    'hero.title': 'Один API,',
    'hero.title.accent': 'все передовые модели.',
    'hero.lead': 'Единая OpenAI-совместимая точка доступа для GPT, Claude, Gemini и других моделей. Одна интеграция, все модели.',
    'hero.cta.primary': 'Получить API-ключ',
    'hero.cta.secondary': 'Открыть документацию',
    'hero.routing': 'Маршрутизация',

    // Metrics
    'metric.1.value': '34+',
    'metric.1.label': 'Онлайн текстовые модели',
    'metric.2.value': '/v1',
    'metric.2.label': 'Совместимо с OpenAI',
    'metric.3.value': '4',
    'metric.3.label': 'Семейства моделей',
    'metric.4.value': 'Docs',
    'metric.4.label': 'Публичная документация',

    // Models
    'models.eyebrow': 'Хаб моделей',
    'models.title': 'Используйте нужную модель без повторной интеграции.',
    'models.desc': 'Vynex объединяет основные семейства моделей в единый предсказуемый API, чтобы команды могли тестировать и переключать модели из консоли.',
    'models.gpt.title': 'GPT',
    'models.gpt.desc': 'Рассуждения, код, вызовы инструментов и универсальные ассистенты.',
    'models.claude.title': 'Claude',
    'models.claude.desc': 'Длинные рассуждения, тексты, анализ и агенты.',
    'models.gemini.title': 'Gemini',
    'models.gemini.desc': 'Мультимодальные модели для структурированных production-процессов.',
    'models.open.title': 'Open',
    'models.open.desc': 'Экономичные маршруты открытых моделей для типовых нагрузок.',

    // Workflow
    'workflow.eyebrow': 'API-процесс',
    'workflow.title': 'Один токен, один Base URL, все поддерживаемые модели.',
    'workflow.desc': 'Сохраните текущий OpenAI SDK и выбирайте upstream-модель через параметр model.',
    'workflow.step1.title': 'Создайте токен',
    'workflow.step1.desc': 'Создайте один API-ключ в консоли и ограничьте его по использованию.',
    'workflow.step2.title': 'Укажите Base URL',
    'workflow.step2.desc': 'Направьте SDK на OpenAI-совместимую точку /v1.',
    'workflow.step3.title': 'Маршрутизируйте по имени модели',
    'workflow.step3.desc': 'Переключайте upstream-модели, меняя только поле model.',

    // Dev links
    'dev.eyebrow': 'Точки входа для разработчиков',
    'dev.title': 'Все необходимое для отправки запросов доступно посетителям.',
    'dev.desc': 'Публичная документация показывает API и примеры, а авторизованные пользователи управляют ключами и тестируют вызовы из консоли.',
    'dev.docs.title': 'Документация API',
    'dev.docs.desc': 'Просматривайте endpoints, примеры моделей и форматы запросов.',
    'dev.console.title': 'Консоль',
    'dev.console.desc': 'Управляйте ключами, балансом, логами использования и настройками маршрутизации.',
    'dev.playground.title': 'Playground',
    'dev.playground.desc': 'Тестируйте chat completions перед переносом запросов в код.',

    // CTA
    'cta.title': 'Запускайте AI-функции без интеграции каждого upstream-провайдера.',
    'cta.desc': 'Используйте {brand} как стабильный слой доступа для тестирования моделей, маршрутизации и production-вызовов.',
    'cta.primary': 'Получить API-ключ',
    'cta.secondary': 'Открыть документацию',

    // Footer
    'footer.docs': 'Документация',
    'footer.pricing': 'Цены',
    'footer.console': 'Консоль',

    // Playground
    'playground.title': 'Playground',
    'playground.model': 'Модель',
    'playground.placeholder': 'Введите сообщение...',
    'playground.send': 'Отправить',

    // Pricing
    'pricing.title': 'Цены',
    'pricing.model': 'Модель',
    'pricing.input': 'Цена входа',
    'pricing.output': 'Цена выхода',
    'pricing.group': 'Коэффициент группы',

    // About
    'about.title': 'О проекте',

    // Settings
    'settings.title': 'Настройки',
    'settings.site': 'Сайт',
    'settings.auth': 'Аутентификация',
    'settings.billing': 'Биллинг',
    'settings.content': 'Контент',
    'settings.models': 'Модели',
    'settings.operations': 'Операции',
    'settings.security': 'Безопасность',
    'settings.save': 'Сохранить',

    // Not Found
    'notFound.title': 'Страница не найдена',
    'notFound.message': 'Страница, которую вы ищете, не существует или была перемещена.',
    'notFound.home': 'На главную',

    // Console Navigation
    'nav.dashboard': 'Панель',
    'nav.keys': 'API-ключи',
    'nav.wallet': 'Кошелек',
    'nav.usageLogs': 'Логи использования',
    'nav.playground': 'Playground',
    'nav.subscriptions': 'Подписки',
    'nav.profile': 'Профиль',
    'nav.channels': 'Каналы',
    'nav.users': 'Пользователи',
    'nav.redemptions': 'Коды пополнения',
    'nav.settings': 'Настройки',
    'nav.logout': 'Выйти',
    'nav.userSection': 'Консоль',
    'nav.adminSection': 'Администрирование',
    'nav.rootSection': 'Система',

    // Dashboard
    'dashboard.title': 'Панель',
    'dashboard.totalQuota': 'Общая квота',
    'dashboard.usedQuota': 'Использованная квота',
    'dashboard.requests': 'Запросы',
    'dashboard.recentLogs': 'Последние логи',

    // Keys
    'keys.title': 'API-ключи',
    'keys.create': 'Создать ключ',
    'keys.name': 'Название',
    'keys.key': 'Ключ',
    'keys.status': 'Статус',
    'keys.quota': 'Квота',
    'keys.actions': 'Действия',
    'keys.delete': 'Удалить',
    'keys.copy': 'Копировать',

    // Wallet
    'wallet.title': 'Кошелек',
    'wallet.balance': 'Текущий баланс',
    'wallet.topUp': 'Пополнить',
    'wallet.history': 'История пополнений',
    'wallet.affCode': 'Партнерская программа',

    // Logs
    'logs.title': 'Логи использования',
    'logs.time': 'Время',
    'logs.model': 'Модель',
    'logs.token': 'Токен',
    'logs.quota': 'Квота',
    'logs.channel': 'Канал',

    // Profile
    'profile.title': 'Профиль',
    'profile.displayName': 'Отображаемое имя',
    'profile.changePassword': 'Сменить пароль',
    'profile.save': 'Сохранить изменения',
    'profile.2fa': 'Двухфакторная аутентификация',
    'profile.passkey': 'Passkey',

    // Subscriptions
    'subs.title': 'Подписки',
    'subs.plans': 'Доступные планы',
    'subs.active': 'Активные подписки',
    'subs.purchase': 'Купить',

    // Auth
    'auth.signIn.title': 'Вход',
    'auth.signIn.submit': 'Войти',
    'auth.signIn.noAccount': 'Нет аккаунта?',
    'auth.signIn.forgotPassword': 'Забыли пароль?',
    'auth.register.title': 'Создать аккаунт',
    'auth.register.submit': 'Зарегистрироваться',
    'auth.register.hasAccount': 'Уже есть аккаунт?',
    'auth.register.verificationSent': 'Письмо подтверждения отправлено. Проверьте почту.',
    'auth.forgotPassword.title': 'Сброс пароля',
    'auth.forgotPassword.submit': 'Отправить ссылку',
    'auth.forgotPassword.success': 'Ссылка для сброса отправлена на вашу почту.',
    'auth.forgotPassword.backToSignIn': 'Вернуться ко входу',
    'auth.resetPassword.title': 'Новый пароль',
    'auth.resetPassword.submit': 'Сбросить пароль',
    'auth.resetPassword.success': 'Пароль успешно сброшен. Переход ко входу...',
    'auth.username': 'Имя пользователя',
    'auth.password': 'Пароль',
    'auth.confirmPassword': 'Подтвердите пароль',
    'auth.email': 'Email (необязательно)',
    'auth.2faCode': 'Код 2FA',
    'auth.2faRequired': 'Требуется двухфакторная аутентификация',
    'auth.registerSuccess': 'Аккаунт успешно создан!',
    'auth.or': 'или',

    // Channels
    'channels.title': 'Каналы',
    'channels.create': 'Добавить канал',
    'channels.edit': 'Редактировать канал',
    'channels.test': 'Тест',
    'channels.balance': 'Баланс',
    'channels.delete': 'Удалить',
    'channels.name': 'Название',
    'channels.type': 'Тип',
    'channels.status': 'Статус',
    'channels.models': 'Модели',
    'channels.baseUrl': 'Base URL',
    'channels.key': 'API-ключ',
    'channels.weight': 'Вес',
    'channels.priority': 'Приоритет',
    'channels.group': 'Группа',
    'channels.testResult': 'Время ответа',
    'channels.updateBalance': 'Обновить баланс',

    // Users
    'users.title': 'Пользователи',
    'users.create': 'Добавить пользователя',
    'users.edit': 'Редактировать пользователя',
    'users.role': 'Роль',
    'users.quota': 'Квота',
    'users.status': 'Статус',
    'users.delete': 'Удалить',
    'users.search': 'Поиск пользователей...',

    // Models
    'models.pageTitle': 'Модели',
    'models.create': 'Добавить модель',
    'models.edit': 'Редактировать модель',
    'models.vendor': 'Поставщик',
    'models.inputPrice': 'Цена входа',
    'models.outputPrice': 'Цена выхода',
    'models.enabled': 'Включено',
    'models.modelId': 'ID модели',

    // Redemptions
    'redemptions.title': 'Коды пополнения',
    'redemptions.create': 'Создать коды',
    'redemptions.key': 'Код',
    'redemptions.quota': 'Квота',
    'redemptions.status': 'Статус',
    'redemptions.delete': 'Удалить',
    'redemptions.deleteInvalid': 'Удалить все недействительные',
    'redemptions.count': 'Количество',

    // Common
    'common.save': 'Сохранить',
    'common.cancel': 'Отмена',
    'common.confirm': 'Подтвердить',
    'common.deleteConfirm': 'Вы уверены, что хотите удалить это?',
    'common.loading': 'Загрузка...',
    'common.error': 'Произошла ошибка',
    'common.noData': 'Нет данных',
    'common.search': 'Поиск...',
    'common.enabled': 'Включено',
    'common.disabled': 'Отключено',
    'common.active': 'Активно',
    'common.expired': 'Истекло',
    'common.unlimited': 'Без ограничений',
    'common.all': 'Все',
    'common.page': 'Страница',
    'common.of': 'из',
    'common.total': 'Всего',
    'common.baseUrl': 'Base URL',
    'common.key': 'Ключ',
    'common.group': 'Группа',
    'common.weight': 'Вес',
    'common.priority': 'Приоритет',
    'common.username': 'Имя пользователя',
    'common.email': 'Email',
    'common.passwordKeepHint': 'оставьте пустым, чтобы сохранить текущий',
    'common.balance': 'Баланс',
    'common.usageOverview': 'Обзор использования',
    'common.quotaUsd': 'Квота ($)',
    'common.expiredTime': 'Время истечения',
    'common.neverExpireHint': 'Оставьте пустым, чтобы срок не истекал',
    'common.allModelsHint': 'Оставьте пустым для всех моделей',
    'common.affiliateCode': 'Партнерский код',
    'common.inviteLink': 'Ссылка приглашения',
    'common.role': 'Роль',
    'common.code': 'Код',
    'common.link': 'Ссылка',
    'common.affiliate': 'Партнерская программа',
    'common.period': 'Период',
    'common.date': 'Дата',
    'common.description': 'Описание',
    'common.commaSeparated': 'через запятую',
  },
}

type I18nContextValue = {
  lang: Lang
  languages: typeof languages
  setLanguage: (next: Lang) => void
  t: (key: string, vars?: Record<string, string>) => string
}

const I18nContext = createContext<I18nContextValue>({
  lang: 'en',
  languages,
  setLanguage: () => {},
  t: (k) => k,
})

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('vynex-lang') : null
    if (isLang(saved)) return saved
    const browser = navigator.language.toLowerCase()
    if (browser.startsWith('zh')) return 'zh'
    if (browser.startsWith('ru')) return 'ru'
    return 'en'
  })

  const setLanguage = useCallback((next: Lang) => {
    setLang(next)
    localStorage.setItem('vynex-lang', next)
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
    <I18nContext.Provider value={{ lang, languages, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  return useContext(I18nContext)
}
