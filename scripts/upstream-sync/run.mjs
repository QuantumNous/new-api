import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { PRESERVED_PATHS, TRANSFORM_PATHS } from './manifest.mjs'

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..'
)
const upstreamRef = process.env.UPSTREAM_SYNC_UPSTREAM_REF || 'upstream/main'
const sourceRef = process.env.UPSTREAM_SYNC_SOURCE_REF || 'origin/main'
const mirrorBranch = process.env.UPSTREAM_SYNC_MIRROR_BRANCH || 'upstream-main'
const branchPrefix = process.env.UPSTREAM_SYNC_BRANCH_PREFIX || 'sync/upstream'
const branchDate =
  new Date().toISOString().slice(0, 10).replaceAll('-', '') +
  '-' +
  new Date().toISOString().slice(11, 16).replace(':', '')
const syncBranch = `${branchPrefix}-${branchDate}`
const worktreePath = path.join(
  os.tmpdir(),
  `new-api-${syncBranch.replace(/[\\/]/g, '-')}`
)

function runGit(args, options = {}) {
  return execFileSync('git', args, {
    cwd: repoRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    ...options,
  }).trim()
}

function runGitBuffer(args, options = {}) {
  return execFileSync('git', args, {
    cwd: repoRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'buffer',
    ...options,
  })
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8')
}

function writeText(filePath, value) {
  ensureDir(filePath)
  fs.writeFileSync(filePath, value)
}

function replaceOrThrow(input, searchValue, replaceValue, label) {
  if (!input.includes(searchValue)) {
    throw new Error(`Unable to patch ${label}`)
  }
  return input.replace(searchValue, replaceValue)
}

function copyPreservedPath(relativePath) {
  const fileBuffer = runGitBuffer(['show', `${sourceRef}:${relativePath}`])
  const destination = path.join(worktreePath, relativePath)
  ensureDir(destination)
  fs.writeFileSync(destination, fileBuffer)
}

function patchConstants() {
  writeText(
    path.join(worktreePath, 'web/default/src/lib/constants.ts'),
    `/**
 * Application-wide constants
 */

import {
  getDefaultLogo,
  getDefaultSystemName,
} from '@/branding'

// System Configuration Defaults
export const DEFAULT_SYSTEM_NAME = getDefaultSystemName()
export const DEFAULT_LOGO = getDefaultLogo()

// LocalStorage Keys
export const STORAGE_KEYS = {
  SYSTEM_NAME: 'system_name',
  LOGO: 'logo',
  FOOTER_HTML: 'footer_html',
} as const
`
  )
}

function patchDomUtils() {
  writeText(
    path.join(worktreePath, 'web/default/src/lib/dom-utils.ts'),
    `function upsertLinkTag(
  selector: string,
  create: () => HTMLLinkElement,
  href: string
) {
  if (typeof document === 'undefined' || !href) return
  try {
    const next = new URL(href, window.location.href).href
    const existing = document.querySelector<HTMLLinkElement>(selector)
    if (existing && existing.href === next) return
    const link = existing ?? create()
    link.href = href
    if (!existing) {
      document.head.appendChild(link)
    }
  } catch {
    // Ignore malformed URLs
  }
}

export function applyMetaTagToDom(name: string, content: string) {
  if (typeof document === 'undefined' || !content) return
  let meta = document.querySelector<HTMLMetaElement>(\`meta[name="\${name}"]\`)
  if (!meta) {
    meta = document.createElement('meta')
    meta.setAttribute('name', name)
    document.head.appendChild(meta)
  }
  meta.setAttribute('content', content)
}

export function applyDocumentTitle(title: string) {
  if (typeof document === 'undefined' || !title) return
  document.title = title
  applyMetaTagToDom('title', title)
}

export function applyFaviconToDom(url: string) {
  upsertLinkTag(
    'link[rel~="icon"]',
    () => {
      const link = document.createElement('link')
      link.rel = 'icon'
      return link
    },
    url
  )
}

export function applyAppleTouchIconToDom(url: string) {
  upsertLinkTag(
    'link[rel="apple-touch-icon"]',
    () => {
      const link = document.createElement('link')
      link.rel = 'apple-touch-icon'
      return link
    },
    url
  )
}

export function applyManifestToDom(url: string) {
  upsertLinkTag(
    'link[rel="manifest"]',
    () => {
      const link = document.createElement('link')
      link.rel = 'manifest'
      return link
    },
    url
  )
}

export function applyThemeColorToDom(color: string) {
  applyMetaTagToDom('theme-color', color)
}
`
  )
}

function patchMain() {
  const filePath = path.join(worktreePath, 'web/default/src/main.tsx')
  let source = readText(filePath)

  source = replaceOrThrow(
    source,
    "import { applyFaviconToDom } from '@/lib/dom-utils'\n",
    "import {\n  applyAppleTouchIconToDom,\n  applyDocumentTitle,\n  applyFaviconToDom,\n  applyManifestToDom,\n  applyMetaTagToDom,\n  applyThemeColorToDom,\n} from '@/lib/dom-utils'\nimport {\n  getActiveBrandProfile,\n  getDefaultLogo,\n  getDefaultSystemName,\n} from '@/branding'\n",
    'main.tsx imports'
  )

  source = source.replace(
    /\/\/ Set document\.title and favicon from cached status, then refresh from network[\s\S]*?\}\)\(\)\n/,
    `// Set document.title and favicon from cached status, then refresh from network
;(function initSystemBranding() {
  try {
    if (typeof window === 'undefined' || typeof document === 'undefined') return

    const activeBrand = getActiveBrandProfile()
    const defaultSystemName = getDefaultSystemName()
    const defaultLogo = getDefaultLogo()

    const applyResolvedBranding = (systemName: string, logo: string) => {
      applyDocumentTitle(systemName)
      applyFaviconToDom(logo)

      if (!activeBrand) return

      applyMetaTagToDom('description', activeBrand.meta.description)
      applyThemeColorToDom(activeBrand.meta.themeColor)
      applyManifestToDom(activeBrand.meta.manifest)
      applyAppleTouchIconToDom(activeBrand.meta.appleTouchIcon)
    }

    applyResolvedBranding(defaultSystemName, defaultLogo)

    try {
      const saved = localStorage.getItem('status')
      if (saved) {
        const s = JSON.parse(saved)
        applyResolvedBranding(
          s?.system_name || defaultSystemName,
          s?.logo || defaultLogo
        )
      }
    } catch {
      /* empty */
    }

    getStatus()
      .then((s) => {
        applyResolvedBranding(
          (s?.system_name as string | undefined) || defaultSystemName,
          (s?.logo as string | undefined) || defaultLogo
        )
        try {
          localStorage.setItem('status', JSON.stringify(s))
        } catch {
          /* empty */
        }
      })
      .catch(() => {
        /* empty */
      })
  } catch {
    /* empty */
  }
})()
`
  )

  writeText(filePath, source)
}

function patchFooter() {
  const filePath = path.join(
    worktreePath,
    'web/default/src/components/layout/components/footer.tsx'
  )
  let source = readText(filePath)

  source = replaceOrThrow(
    source,
    "import { useSystemConfig } from '@/hooks/use-system-config'\n",
    "import { getDefaultFooterHtml } from '@/branding'\nimport { useSystemConfig } from '@/hooks/use-system-config'\n",
    'footer.tsx imports'
  )

  source = replaceOrThrow(
    source,
    "  const displayColumns = props.columns ?? fallbackColumns\n\n  if (footerHtml) {\n",
    "  const displayColumns = props.columns ?? fallbackColumns\n  const resolvedFooterHtml = footerHtml || getDefaultFooterHtml()\n\n  if (resolvedFooterHtml) {\n",
    'footer.tsx resolvedFooterHtml'
  )

  source = replaceOrThrow(
    source,
    "              dangerouslySetInnerHTML={{ __html: footerHtml }}\n",
    "              dangerouslySetInnerHTML={{ __html: resolvedFooterHtml }}\n",
    'footer.tsx html binding'
  )

  writeText(filePath, source)
}

function patchAbout() {
  const filePath = path.join(
    worktreePath,
    'web/default/src/features/about/index.tsx'
  )
  let source = readText(filePath)

  source = replaceOrThrow(
    source,
    "import { PublicLayout } from '@/components/layout'\n",
    "import { getActiveBrandProfile, getDefaultAboutMarkdown } from '@/branding'\nimport { PublicLayout } from '@/components/layout'\n",
    'about.tsx imports'
  )

  source = replaceOrThrow(
    source,
    "  const rawContent = data?.data?.trim() ?? ''\n",
    "  const brandProfile = getActiveBrandProfile()\n  const rawContent = data?.data?.trim() ?? ''\n",
    'about.tsx brand profile declaration'
  )

  source = replaceOrThrow(
    source,
    `  if (!hasContent) {
    return (
      <PublicLayout>
        <EmptyAboutState />
      </PublicLayout>
    )
  }
`,
    `  if (!hasContent) {
    const defaultAboutContent = getDefaultAboutMarkdown()

    if (defaultAboutContent) {
      return (
        <PublicLayout>
          <div className='mx-auto max-w-6xl px-4 py-8'>
            <Markdown className='prose-neutral dark:prose-invert max-w-none'>
              {defaultAboutContent}
            </Markdown>
          </div>
        </PublicLayout>
      )
    }

    return (
      <PublicLayout>
        <EmptyAboutState />
      </PublicLayout>
    )
  }
`,
    'about.tsx fallback block'
  )

  source = replaceOrThrow(
    source,
    "          title={t('About')}\n",
    "          title={brandProfile?.displayName || t('About')}\n",
    'about.tsx iframe title'
  )

  writeText(filePath, source)
}

function patchHero() {
  const filePath = path.join(
    worktreePath,
    'web/default/src/features/home/components/sections/hero.tsx'
  )
  let source = readText(filePath)

  source = replaceOrThrow(
    source,
    "import { useSystemConfig } from '@/hooks/use-system-config'\n",
    "import { getActiveBrandProfile } from '@/branding'\nimport { useSystemConfig } from '@/hooks/use-system-config'\n",
    'hero.tsx imports'
  )

  source = replaceOrThrow(
    source,
    "  const { t } = useTranslation()\n  const { systemName } = useSystemConfig()\n",
    "  const { t } = useTranslation()\n  const { systemName } = useSystemConfig()\n  const brandProfile = getActiveBrandProfile()\n  const titleLeading = brandProfile?.hero.titleLeading || t('Unified API Gateway for')\n  const titleHighlight = brandProfile?.hero.titleHighlight || t('All Your AI Models')\n  const description =\n    brandProfile?.hero.description ||\n    `${systemName} ${t(\n      'is an open-source AI API gateway for self-hosted deployments. Connect multiple upstream services, manage models, keys, quotas, logs, and routing policies in one place.'\n    )}`\n",
    'hero.tsx brand declarations'
  )

  source = replaceOrThrow(
    source,
    `          {t('Unified API Gateway for')}
          <br />
          <span className='bg-gradient-to-r from-blue-400 via-violet-400 to-purple-500 bg-clip-text text-transparent'>
            {t('All Your AI Models')}
          </span>
`,
    `          {titleLeading}
          <br />
          <span className='bg-gradient-to-r from-blue-400 via-violet-400 to-purple-500 bg-clip-text text-transparent'>
            {titleHighlight}
          </span>
`,
    'hero.tsx title copy'
  )

  source = replaceOrThrow(
    source,
    `          {systemName}{' '}
          {t(
            'is an open-source AI API gateway for self-hosted deployments. Connect multiple upstream services, manage models, keys, quotas, logs, and routing policies in one place.'
          )}
`,
    `          {description}
`,
    'hero.tsx description copy'
  )

  writeText(filePath, source)
}

function appendOutput(name, value) {
  if (!process.env.GITHUB_OUTPUT) return
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`)
}

runGit(['fetch', 'origin', '--prune'])
runGit(['fetch', 'upstream', '--prune'])
runGit(['branch', '-f', mirrorBranch, upstreamRef])

if (fs.existsSync(worktreePath)) {
  runGit(['worktree', 'remove', '--force', worktreePath])
  fs.rmSync(worktreePath, { recursive: true, force: true })
}

runGit(['worktree', 'add', '--force', '-B', syncBranch, worktreePath, mirrorBranch])

for (const relativePath of PRESERVED_PATHS) {
  copyPreservedPath(relativePath)
}

patchConstants()
patchDomUtils()
patchMain()
patchFooter()
patchAbout()
patchHero()

for (const relativePath of TRANSFORM_PATHS) {
  if (!fs.existsSync(path.join(worktreePath, relativePath))) {
    throw new Error(`Missing transformed file: ${relativePath}`)
  }
}

const changed = execFileSync('git', ['status', '--short'], {
  cwd: worktreePath,
  encoding: 'utf8',
}).trim()

appendOutput('mirror_branch', mirrorBranch)
appendOutput('sync_branch', syncBranch)
appendOutput('worktree_path', worktreePath)
appendOutput('changed', changed ? 'true' : 'false')

console.log(
  JSON.stringify(
    {
      mirrorBranch,
      syncBranch,
      worktreePath,
      changed: Boolean(changed),
    },
    null,
    2
  )
)
