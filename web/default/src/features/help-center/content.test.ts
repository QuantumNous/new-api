import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  HELP_ARTICLES,
  HELP_CATEGORIES,
  getHelpArticleBySlug,
  getHelpCategoryByKey,
} from './content.ts'

const competitorTerms = [
  'New API',
  'NewAPI',
  'iKunCode',
  'IKunCode',
  'CodexZh',
  'AI HUB API',
]

const plannedSlugs = [
  'getting-started',
  'account-registration',
  'create-api-key',
  'billing-pricing',
  'quick-use',
  'chat-completions',
  'image-generation',
  'models-list',
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
  'factory-droid-cli',
  'openclaw',
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
  'faq',
  'auth-errors',
  'billing-errors',
  'client-config-errors',
  'support-feedback',
  'support-community',
  'faq-quota-channel-deployment',
  'codex-client-troubleshooting',
  'support-service-scope',
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
]

describe('help center content', () => {
  test('ships help articles in landing order with second-level pages', () => {
    assert.deepEqual(
      HELP_ARTICLES.map((article) => article.slug),
      plannedSlugs
    )
    assert.deepEqual(
      HELP_CATEGORIES.map((category) => category.key),
      ['getting-started', 'quick-use', 'third-party-tools', 'advanced-usage', 'faq', 'api-reference']
    )
  })

  test('connects every category to the planned concrete pages', () => {
    const articleSlugs = new Set(HELP_ARTICLES.map((article) => article.slug))

    assert.deepEqual(
      HELP_CATEGORIES.map((category) => category.articleSlugs.length),
      [4, 4, 28, 66, 9, 81]
    )

    for (const category of HELP_CATEGORIES) {
      for (const slug of category.articleSlugs) {
        assert.equal(articleSlugs.has(slug), true, `${category.key}:${slug}`)
        assert.equal(getHelpArticleBySlug(slug)?.categoryKey, category.key)
      }
    }
  })

  test('uses stable second-level outlines for beginner-facing pages', () => {
    for (const article of HELP_ARTICLES) {
      assert.ok(article.title.includes('aiapi114'))
      assert.ok(article.summary.length >= 24)
      assert.ok(article.sections.length >= 3)
      assert.ok(
        article.markdown.includes('## 适合先读这篇的人') ||
          article.markdown.includes('## 适合阅读这篇的人')
      )
      assert.ok(article.markdown.includes('## 操作步骤') || article.markdown.includes('## 接入步骤'))
      assert.ok(article.markdown.includes('## 检查清单'))
    }
  })

  test('replaces competitor platform names in user-facing markdown', () => {
    const corpus = HELP_ARTICLES.map((article) => article.markdown).join('\n')

    for (const term of competitorTerms) {
      assert.equal(corpus.includes(term), false, term)
    }
  })

  test('keeps writer and reviewer audit evidence for each article', () => {
    for (const article of HELP_ARTICLES) {
      assert.ok(article.sourceBasis.length >= 1)
      assert.equal(article.audit.writer, 'PASS')
      assert.equal(article.audit.reviewer, 'PASS')
      assert.ok(article.audit.notes.some((note) => note.includes('符合大纲')))
      assert.ok(article.audit.notes.some((note) => note.includes('竞品平台')))
    }
  })

  test('looks up category and article by route key', () => {
    assert.equal(getHelpArticleBySlug('api-chat')?.title, 'aiapi114 对话接口说明')
    assert.equal(getHelpArticleBySlug('api-rerank')?.title, 'aiapi114 Rerank 接口说明')
    assert.equal(getHelpArticleBySlug('astrbot')?.title, 'aiapi114 配置 AstrBot')
    assert.equal(getHelpArticleBySlug('admin-channel-management')?.title, 'aiapi114 管理员渠道管理')
    assert.equal(getHelpArticleBySlug('aionui')?.title, 'aiapi114 配置 AionUi')
    assert.equal(getHelpArticleBySlug('api-responses')?.title, 'aiapi114 Responses 接口说明')
    assert.equal(getHelpArticleBySlug('console-api-token')?.title, 'aiapi114 控制台 API Key 管理')
    assert.equal(getHelpArticleBySlug('support-feedback')?.title, 'aiapi114 问题反馈指南')
    assert.equal(getHelpArticleBySlug('api-completions')?.title, 'aiapi114 Completions 接口说明')
    assert.equal(getHelpArticleBySlug('installation-overview')?.title, 'aiapi114 安装部署总览')
    assert.equal(getHelpArticleBySlug('api-files')?.title, 'aiapi114 Files 接口说明')
    assert.equal(getHelpArticleBySlug('onepanel-deployment')?.title, 'aiapi114 1Panel 部署')
    assert.equal(getHelpArticleBySlug('api-management-oauth')?.title, 'aiapi114 OAuth 管理接口说明')
    assert.equal(getHelpArticleBySlug('admin-chat-settings')?.title, 'aiapi114 聊天集成设置')
    assert.equal(getHelpArticleBySlug('api-payment-webhooks')?.title, 'aiapi114 支付回调接口说明')
    assert.equal(getHelpArticleBySlug('api-video-sora')?.title, 'aiapi114 Sora 视频接口说明')
    assert.equal(getHelpCategoryByKey('faq')?.title, '常见错误答疑')
    assert.equal(getHelpArticleBySlug('missing'), undefined)
  })
})
