import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const defaultProjectRoot = path.resolve(__dirname, '..', '..', '..')

export const categories = [
  {
    key: 'start',
    title: '开始使用',
    description: '完成注册、充值、创建 API Key 和第一次调用。',
  },
  {
    key: 'tools',
    title: '工具配置',
    description: '把 aiapi114 接入常用客户端、CLI 和开发工具。',
  },
  {
    key: 'billing',
    title: '模型与计费',
    description: '理解模型分组、价格、余额和使用记录。',
  },
  {
    key: 'troubleshooting',
    title: '排查与支持',
    description: '定位认证、超时、分组不可用和客户端配置问题。',
  },
]

export const defaultSources = [
  {
    category: 'start',
    slug: 'account-registration',
    title: '注册和登录 aiapi114',
    summary: '完成账号注册、邮箱验证、登录和密码找回。',
    sourcePath: 'docs/reference-help-docs/newapi-ai/guide/feature-guide/user/auth.md',
    imageMap: {
      '../../../assets/guide/feature-guide/login.png': 'assets/images/account-login-aiapi114.png',
      '../../../assets/guide/feature-guide/register.png': 'assets/images/account-register-aiapi114.png',
    },
  },
  {
    category: 'start',
    slug: 'quick-start',
    title: '从充值到第一次调用',
    summary: '按顺序完成余额充值、令牌创建和基础调用配置。',
    sourcePath: 'docs/reference-help-docs/codexzh-ai-hub-api/quick-start.md',
    imageMap: {
      'https://doc.aiapi114.com/assets/1.BnqWLpa7.jpg': 'assets/images/quick-start-wallet-aiapi114.png',
      'https://doc.aiapi114.com/assets/2.60F2g-2c.jpg': 'assets/images/quick-start-keys-aiapi114.png',
      'https://doc.aiapi114.com/assets/3.Cm5gFkwX.jpg': 'assets/images/quick-start-token-form-aiapi114.png',
    },
  },
  {
    category: 'start',
    slug: 'create-api-key',
    title: '创建和保存 API Key',
    summary: '创建专属 Key，选择合适分组，并按安全要求保存。',
    sourcePath: 'docs/reference-help-docs/ikuncode/guide/create-key.md',
  },
  {
    category: 'start',
    slug: 'edit-api-key',
    title: '修改令牌设置',
    summary: '调整令牌名称、额度限制、速率限制和启用状态。',
    sourcePath: 'docs/reference-help-docs/ikuncode/guide/modify-token.md',
    imageMap: {
      'https://doc.aiapi114.com/images/tu3_new.png': 'assets/images/api-key-edit-aiapi114.png',
    },
  },
  {
    category: 'tools',
    slug: 'cherry-studio',
    title: '配置 Cherry Studio',
    summary: '在 Cherry Studio 中添加 aiapi114 提供商、模型和图像模型。',
    sourcePath: 'docs/reference-help-docs/newapi-ai/apps/cherry-studio.md',
    imageMap: {
      '../assets/cherry_studio/copy_api_key.png': 'assets/images/cherry-copy-api-key-aiapi114.png',
    },
  },
  {
    category: 'tools',
    slug: 'claude-code',
    title: '配置 Claude Code',
    summary: '使用 aiapi114 Key 和 API 地址配置 Claude Code。',
    sourcePath: 'docs/reference-help-docs/newapi-ai/apps/claude-code.md',
  },
  {
    category: 'tools',
    slug: 'codex-cli',
    title: '配置 OpenAI Codex CLI',
    summary: '把 Codex CLI 的模型、Base URL 和 Key 指向 aiapi114。',
    sourcePath: 'docs/reference-help-docs/newapi-ai/apps/codex-cli.md',
  },
  {
    category: 'tools',
    slug: 'cc-switch',
    title: '使用 CC-Switch 管理配置',
    summary: '通过 CC-Switch 快速切换 Claude Code 和相关客户端配置。',
    sourcePath: 'docs/reference-help-docs/newapi-ai/apps/cc-switch.md',
  },
  {
    category: 'billing',
    slug: 'pricing-and-groups',
    title: '价格和模型分组',
    summary: '理解倍率、分组、会员等级和实际价格查看方式。',
    sourcePath: 'docs/reference-help-docs/ikuncode/intro/pricing.md',
  },
  {
    category: 'billing',
    slug: 'usage-logs',
    title: '查看使用记录',
    summary: '通过日志核对请求、模型、消耗、错误和响应时间。',
    sourcePath: 'docs/reference-help-docs/newapi-ai/guide/feature-guide/user/log.md',
    imageMap: {
      '../../../assets/guide/feature-guide/log-list.png': 'assets/images/usage-logs-list-aiapi114.png',
      '../../../assets/guide/feature-guide/log-filter-open.png': 'assets/images/usage-logs-filter-open-aiapi114.png',
      '../../../assets/guide/feature-guide/log-filtered.png': 'assets/images/usage-logs-filtered-aiapi114.png',
      '../../../assets/guide/feature-guide/dashboard-chart.png': 'assets/images/usage-dashboard-overview-aiapi114.png',
    },
  },
  {
    category: 'troubleshooting',
    slug: 'faq',
    title: '常见问题',
    summary: '快速处理注册、余额、Key、分组和客户端配置问题。',
    sourcePath: 'docs/reference-help-docs/ikuncode/support/faq.md',
  },
  {
    category: 'troubleshooting',
    slug: 'connection-errors',
    title: '连接错误和超时排查',
    summary: '排查 API Connect Error、Request Timed Out 和 503。',
    sourcePath: 'docs/reference-help-docs/ikuncode/support/troubleshooting.md',
  },
  {
    category: 'troubleshooting',
    slug: 'support-scope',
    title: '售前售后支持范围',
    summary: '了解哪些问题适合提交给 aiapi114 支持团队。',
    sourcePath: 'docs/reference-help-docs/ikuncode/support/after-sales.md',
  },
]

const competitorReplacements = [
  [/\bNewAPI\b/g, 'aiapi114'],
  [/\bNew API\b/g, 'aiapi114'],
  [/\bIKunCode\b/g, 'aiapi114'],
  [/\bIkunCode\b/g, 'aiapi114'],
  [/\bCodexZh AI HUB API\b/g, 'aiapi114'],
  [/\bAI HUB API\b/g, 'aiapi114'],
  [/\bCodeX\b/g, 'Codex'],
]

const urlReplacements = [
  [/https:\/\/api\.ikuncode\.cc/g, 'https://api.aiapi114.com'],
  [/api\.ikuncode\.cc/g, 'api.aiapi114.com'],
  [/https:\/\/status\.ikuncode\.cc/g, 'https://status.aiapi114.com'],
  [/https:\/\/api\.xbai\.top/g, 'https://api.aiapi114.com'],
  [/https:\/\/docs\.ikuncode\.cc/g, 'https://doc.aiapi114.com'],
  [/https:\/\/docs\.codexzh\.com\/ai-hub-api/g, 'https://doc.aiapi114.com'],
  [/https:\/\/docs\.codexzh\.com/g, 'https://doc.aiapi114.com'],
]

const routeReplacements = [
  [/`\/login`/g, '`/sign-in`'],
  [/`\/register`/g, '`/sign-up`'],
]

export function shouldIncludeSource(sourcePath) {
  const normalized = sourcePath.replaceAll('\\', '/').toLowerCase()
  const blockedSegments = [
    '/admin/',
    '/channel-management/',
    '/model-management/',
    '/vendors/',
    '/system-settings/',
    '/statistics/',
    '/groups/',
    '/redemption/',
  ]
  return !blockedSegments.some((segment) => normalized.includes(segment))
}

export function normalizeMarkdown(markdown, { sourceTitle, sourcePath, imageMap = {} }) {
  let body = extractOriginalBody(markdown)
  body = stripFrontmatter(body)
  body = body.replace(/<Callout[^>]*>/g, '> ')
  body = body.replace(/<\/Callout>/g, '')
  body = body.replace(/^\s*(bash|json|typescript|javascript|shell|powershell)\s*$/gim, '')
  body = body.replace(/^#\s+.+$/m, `# ${sourceTitle}`)
  body = body.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) => {
    const label = alt?.trim() || '未命名图片'
    const mappedUrl = imageMap[url] || imageMap[replaceKnownUrls(url)]
    if (mappedUrl) {
      return `![${label}](${mappedUrl})`
    }
    return `> [图片待替换：${label}；来源 ${sourcePath}；原图 ${url}]`
  })

  for (const [pattern, replacement] of competitorReplacements) {
    body = body.replace(pattern, replacement)
  }
  for (const [pattern, replacement] of urlReplacements) {
    body = body.replace(pattern, replacement)
  }
  for (const [pattern, replacement] of routeReplacements) {
    body = body.replace(pattern, replacement)
  }
  body = body.replace(
    /https:\/\/raw\.githubusercontent\.com\/[^\s)'"]+/g,
    '[脚本链接待替换：请改为 aiapi114 官方托管脚本或手动配置说明]',
  )
  body = body.replace(/sk-[^\s`]+/g, 'AIAPI114_KEY_PLACEHOLDER')

  body = body.replace(/aiapi114 平台/g, 'aiapi114 平台')
  body = body.replace(/\n{3,}/g, '\n\n')
  return body.trim()
}

export async function buildHelpContent({
  projectRoot = defaultProjectRoot,
  outputFile = path.join(defaultProjectRoot, 'web/help-static/assets/content.js'),
  sources = defaultSources,
} = {}) {
  const articles = []

  for (const source of sources) {
    if (!shouldIncludeSource(source.sourcePath)) continue
    const absolutePath = path.join(projectRoot, source.sourcePath)
    const raw = await readFile(absolutePath, 'utf8')
    const markdown = normalizeMarkdown(raw, {
      sourceTitle: source.title,
      sourcePath: source.sourcePath,
      imageMap: source.imageMap,
    })
    articles.push({
      category: source.category,
      slug: source.slug,
      title: source.title,
      summary: source.summary,
      sourcePath: source.sourcePath,
      markdown,
    })
  }

  const availableCategories = categories
    .map((category) => ({
      ...category,
      articleSlugs: articles
        .filter((article) => article.category === category.key)
        .map((article) => article.slug),
    }))
    .filter((category) => category.articleSlugs.length > 0)

  const payload = {
    generatedAt: new Date().toISOString(),
    policy:
      'Reference documents are used for structure and factual coverage. User-facing help content is normalized for aiapi114 and image positions are marked for replacement.',
    categories: availableCategories,
    articles,
  }

  await mkdir(path.dirname(outputFile), { recursive: true })
  await writeFile(
    outputFile,
    `window.AIAPI114_HELP_CONTENT = ${JSON.stringify(payload, null, 2)};\n`,
    'utf8',
  )

  return {
    articleCount: articles.length,
    categoryCount: availableCategories.length,
    outputFile,
  }
}

function replaceKnownUrls(value) {
  let result = value
  for (const [pattern, replacement] of urlReplacements) {
    result = result.replace(pattern, replacement)
  }
  return result
}

function extractOriginalBody(markdown) {
  const marker = '## 原文内容'
  const index = markdown.indexOf(marker)
  if (index === -1) return markdown
  return markdown.slice(index + marker.length).trim()
}

function stripFrontmatter(markdown) {
  return markdown.replace(/^---\n[\s\S]*?\n---\n?/, '').trim()
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await buildHelpContent()
  console.log(`Built ${result.articleCount} help articles into ${result.outputFile}`)
}
