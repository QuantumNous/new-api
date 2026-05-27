import { CORE_HELP_ARTICLES } from './content-core.ts'
import {
  ADVANCED_DETAIL_ARTICLES,
  QUICK_USE_DETAIL_ARTICLES,
  TOOL_DETAIL_ARTICLES,
} from './content-details.ts'
import { EXTENDED_HELP_ARTICLES } from './content-extended.ts'
import {
  EIGHTH_BATCH_ADVANCED_ARTICLES,
  EIGHTH_BATCH_API_ARTICLES,
} from './content-eighth-batch.ts'
import { ELEVENTH_BATCH_API_ARTICLES } from './content-eleventh-batch.ts'
import {
  FIFTH_BATCH_ADVANCED_ARTICLES,
  FIFTH_BATCH_API_ARTICLES,
  FIFTH_BATCH_TOOL_ARTICLES,
} from './content-fifth-batch.ts'
import {
  FOURTH_BATCH_ADVANCED_ARTICLES,
  FOURTH_BATCH_API_ARTICLES,
  FOURTH_BATCH_TOOL_ARTICLES,
} from './content-fourth-batch.ts'
import { ONBOARDING_HELP_ARTICLES } from './content-onboarding.ts'
import {
  NINTH_BATCH_ADVANCED_ARTICLES,
  NINTH_BATCH_API_ARTICLES,
} from './content-ninth-batch.ts'
import {
  TENTH_BATCH_ADVANCED_ARTICLES,
  TENTH_BATCH_API_ARTICLES,
  TENTH_BATCH_SUPPORT_ARTICLES,
} from './content-tenth-batch.ts'
import {
  SIXTH_BATCH_ADVANCED_ARTICLES,
  SIXTH_BATCH_API_ARTICLES,
  SIXTH_BATCH_SUPPORT_ARTICLES,
} from './content-sixth-batch.ts'
import {
  SIXTEENTH_BATCH_ADVANCED_ARTICLES,
  SIXTEENTH_BATCH_SUPPORT_ARTICLES,
  SIXTEENTH_BATCH_TOOL_ARTICLES,
} from './content-sixteenth-batch.ts'
import { SEVENTH_BATCH_ADVANCED_ARTICLES } from './content-seventh-advanced.ts'
import { SEVENTH_BATCH_API_ARTICLES } from './content-seventh-api.ts'
import { API_DETAIL_ARTICLES, SUPPORT_DETAIL_ARTICLES } from './content-support-api.ts'
import {
  THIRD_BATCH_ADVANCED_ARTICLES,
  THIRD_BATCH_API_ARTICLES,
  THIRD_BATCH_TOOL_ARTICLES,
} from './content-third-batch.ts'
import {
  THIRTEENTH_BATCH_ADVANCED_ARTICLES,
  THIRTEENTH_BATCH_API_ARTICLES,
} from './content-thirteenth-batch.ts'
import {
  FOURTEENTH_BATCH_ADVANCED_ARTICLES,
  FOURTEENTH_BATCH_API_ARTICLES,
} from './content-fourteenth-batch.ts'
import {
  FIFTEENTH_BATCH_ADVANCED_ARTICLES,
  FIFTEENTH_BATCH_TOOL_ARTICLES,
} from './content-fifteenth-batch.ts'
import {
  SEVENTEENTH_BATCH_ADVANCED_ARTICLES,
  SEVENTEENTH_BATCH_SUPPORT_ARTICLES,
} from './content-seventeenth-batch.ts'
import { TWELFTH_BATCH_API_ARTICLES } from './content-twelfth-batch.ts'
import type { HelpArticle, HelpCategory } from './types.ts'

export type { HelpArticle, HelpCategory } from './types.ts'

export const HELP_CATEGORIES: HelpCategory[] = [
  {
    key: 'getting-started',
    title: '新手入门',
    description: '从注册、创建 API Key 到完成第一次调用，先把最关键的路径走通。',
    articleSlugs: ['getting-started', 'account-registration', 'create-api-key', 'billing-pricing'],
  },
  {
    key: 'quick-use',
    title: '快速使用',
    description: '用最少配置完成文本、图像、模型列表和用量查看。',
    articleSlugs: ['quick-use', 'chat-completions', 'image-generation', 'models-list'],
  },
  {
    key: 'third-party-tools',
    title: '第三方工具配置',
    description: '把 aiapi114 填入常用客户端、CLI 和机器人，统一理解 Base URL、Key、模型名。',
    articleSlugs: [
      'third-party-tools',
      'cherry-studio',
      'claude-code',
      'codex-cli',
      'lobechat',
      'chatbox',
      'langbot',
      'astrbot',
      'deepchat',
      'fluent-read',
      'luna-translator',
      'memoh',
      'aionui',
      'cc-switch',
      'gemini-cli',
      'opencode-client',
      'alma-client',
      'hapi-remote-control',
      'hapi-cloudflare-ip',
      'ai-mcp-server',
      'ikunimage-generator',
      'claude-code-hub',
      'browser-extension-usage',
      'cc-switch-usage-query',
      'codex-mcp-services',
      'hermes-ai-assistant-config',
      'factory-droid-cli',
      'openclaw',
    ],
  },
  {
    key: 'advanced-usage',
    title: '进阶使用',
    description: '理解模型分组、计费倍率、用量核对、限速和异步任务，降低长期使用成本。',
    articleSlugs: [
      'advanced-usage',
      'model-groups-billing',
      'rate-limits',
      'async-tasks',
      'usage-logs',
      'personal-settings',
      'topup-subscription',
      'admin-channel-management',
      'admin-model-management',
      'admin-log-analysis',
      'admin-user-management',
      'console-dashboard',
      'console-playground',
      'console-wallet',
      'console-api-token',
      'console-profile',
      'console-task-log',
      'installation-overview',
      'docker-compose-deployment',
      'docker-deployment',
      'environment-variables',
      'system-update',
      'system-settings',
      'payment-settings',
      'redemption-management',
      'onepanel-deployment',
      'bt-docker-deployment',
      'cluster-deployment',
      'local-development',
      'admin-group-management',
      'admin-oauth-settings',
      'admin-performance-settings',
      'admin-subscription-settings',
      'admin-chat-settings',
      'admin-dashboard-settings',
      'admin-drawing-settings',
      'admin-operation-settings',
      'admin-other-settings',
      'admin-rate-limit-settings',
      'admin-rate-settings',
      'admin-drawing-log',
      'admin-docs-about-config',
      'platform-acceptable-use',
      'business-collaboration',
      'platform-architecture-overview',
      'platform-operations-observability',
      'console-channel-operations',
      'console-user-operations',
      'console-system-settings-overview',
      'console-release-notes',
      'help-center-navigation-overview',
      'console-chat-import-config',
      'console-usage-log-reading',
      'console-redemption-campaigns',
      'ai-editor-skills-integration',
      'docker-compose-production-checklist',
      'windows-cli-encoding-fix',
      'codex-auto-review-config',
      'codex-notification-workflow',
      'codex-image-generation-workflow',
      'model-selection-strategy',
      'api-token-editing',
      'pricing-and-model-costs',
      'node-runtime-installation',
      'nano-banana-image-model',
      'platform-introduction-overview',
    ],
  },
  {
    key: 'faq',
    title: '常见错误答疑',
    description: '按错误表现定位认证、余额、模型、超时和第三方工具配置问题。',
    articleSlugs: [
      'faq',
      'auth-errors',
      'billing-errors',
      'client-config-errors',
      'support-feedback',
      'support-community',
      'faq-quota-channel-deployment',
      'codex-client-troubleshooting',
      'support-service-scope',
    ],
  },
  {
    key: 'api-reference',
    title: '平台 API 接口描述',
    description: '按开发者常用入口说明兼容协议、认证方式、核心接口和错误处理。',
    articleSlugs: [
      'api-reference',
      'api-auth',
      'api-chat',
      'api-images',
      'api-audio',
      'api-video',
      'api-embeddings',
      'api-rerank',
      'api-realtime',
      'api-video-kling',
      'api-responses',
      'api-completions',
      'api-moderations',
      'api-token-management',
      'api-files',
      'api-management-auth',
      'api-management-channels',
      'api-management-users',
      'api-management-logs',
      'api-management-payments',
      'api-management-redemptions',
      'api-management-system',
      'api-model-list',
      'api-management-models',
      'api-management-groups',
      'api-management-oauth',
      'api-management-2fa',
      'api-management-statistics',
      'api-management-tasks',
      'api-management-vendors',
      'api-public-system',
      'api-system-setup',
      'api-user-auth',
      'api-security-verification',
      'api-oauth-login',
      'api-payment-webhooks',
      'api-payment-topup',
      'api-image-edits',
      'api-qwen-images',
      'api-video-sora',
      'api-video-jimeng',
      'api-gemini-chat',
      'api-gemini-images',
      'api-fine-tuning',
      'api-engine-embeddings',
      'api-user-management-admin',
      'api-user-self-profile',
      'api-passkey-management',
      'api-channel-batch-operations',
      'api-channel-testing',
      'api-log-statistics',
      'api-system-options',
      'api-token-lifecycle',
      'api-token-usage',
      'api-redemption-codes',
      'api-redemption-topup',
      'api-log-search',
      'api-invite-quota',
      'api-user-topup-records',
      'api-channel-maintenance',
      'api-channel-multikey-tags',
      'api-prefill-groups',
      'api-channel-crud',
      'api-channel-model-sync',
      'api-payment-methods',
      'api-two-factor-settings',
      'api-task-management',
      'api-midjourney-tasks',
      'api-user-models-token',
      'api-model-sync',
      'api-payment-self-records',
      'api-user-security-admin',
      'api-user-self-service',
      'api-oauth-binding',
      'api-public-system-content',
      'api-vendor-management-detail',
      'api-model-management-detail',
      'api-channel-sensitive-maintenance',
      'api-audit-cleanup',
      'api-user-auth-recovery',
      'api-specialized-model-endpoints',
    ],
  },
]

export const HELP_ARTICLES: HelpArticle[] = [
  getRequiredCoreArticle('getting-started'),
  ...ONBOARDING_HELP_ARTICLES,
  getRequiredCoreArticle('quick-use'),
  ...QUICK_USE_DETAIL_ARTICLES,
  getRequiredExtendedArticle('third-party-tools'),
  ...TOOL_DETAIL_ARTICLES,
  ...THIRD_BATCH_TOOL_ARTICLES,
  ...FOURTH_BATCH_TOOL_ARTICLES,
  ...FIFTH_BATCH_TOOL_ARTICLES,
  ...FIFTEENTH_BATCH_TOOL_ARTICLES,
  ...SIXTEENTH_BATCH_TOOL_ARTICLES,
  getRequiredExtendedArticle('advanced-usage'),
  ...ADVANCED_DETAIL_ARTICLES,
  ...THIRD_BATCH_ADVANCED_ARTICLES,
  ...FOURTH_BATCH_ADVANCED_ARTICLES,
  ...FIFTH_BATCH_ADVANCED_ARTICLES,
  ...SIXTH_BATCH_ADVANCED_ARTICLES,
  ...SEVENTH_BATCH_ADVANCED_ARTICLES,
  ...EIGHTH_BATCH_ADVANCED_ARTICLES,
  ...NINTH_BATCH_ADVANCED_ARTICLES,
  ...TENTH_BATCH_ADVANCED_ARTICLES,
  ...THIRTEENTH_BATCH_ADVANCED_ARTICLES,
  ...FOURTEENTH_BATCH_ADVANCED_ARTICLES,
  ...FIFTEENTH_BATCH_ADVANCED_ARTICLES,
  ...SIXTEENTH_BATCH_ADVANCED_ARTICLES,
  ...SEVENTEENTH_BATCH_ADVANCED_ARTICLES,
  getRequiredCoreArticle('faq'),
  ...SUPPORT_DETAIL_ARTICLES,
  ...SIXTH_BATCH_SUPPORT_ARTICLES,
  ...TENTH_BATCH_SUPPORT_ARTICLES,
  ...SIXTEENTH_BATCH_SUPPORT_ARTICLES,
  ...SEVENTEENTH_BATCH_SUPPORT_ARTICLES,
  getRequiredExtendedArticle('api-reference'),
  ...API_DETAIL_ARTICLES,
  ...THIRD_BATCH_API_ARTICLES,
  ...FOURTH_BATCH_API_ARTICLES,
  ...FIFTH_BATCH_API_ARTICLES,
  ...SIXTH_BATCH_API_ARTICLES,
  ...SEVENTH_BATCH_API_ARTICLES,
  ...EIGHTH_BATCH_API_ARTICLES,
  ...NINTH_BATCH_API_ARTICLES,
  ...TENTH_BATCH_API_ARTICLES,
  ...ELEVENTH_BATCH_API_ARTICLES,
  ...TWELFTH_BATCH_API_ARTICLES,
  ...THIRTEENTH_BATCH_API_ARTICLES,
  ...FOURTEENTH_BATCH_API_ARTICLES,
]

function getRequiredCoreArticle(slug: string) {
  const article = CORE_HELP_ARTICLES.find((item) => item.slug === slug)
  if (!article) {
    throw new Error(`Missing core help article: ${slug}`)
  }
  return article
}

function getRequiredExtendedArticle(slug: string) {
  const article = EXTENDED_HELP_ARTICLES.find((item) => item.slug === slug)
  if (!article) {
    throw new Error(`Missing extended help article: ${slug}`)
  }
  return article
}

export function getHelpArticleBySlug(slug: string) {
  return HELP_ARTICLES.find((article) => article.slug === slug)
}

export function getHelpCategoryByKey(key: string) {
  return HELP_CATEGORIES.find((category) => category.key === key)
}
