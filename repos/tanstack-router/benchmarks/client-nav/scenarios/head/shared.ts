/**
 * Shared definition of the `head` scenario: route head() payloads, the click
 * sequence, and per-step sanity assertions. The three framework apps consume
 * these builders so the workload is identical modulo the rendering layer.
 */

const siteName = 'Head Bench'

export const docsSections = ['api', 'guide', 'cli'] as const
export const articleIds = ['1', '2', '3'] as const

export const homeTitle = `Home | ${siteName}`
export const settingsTitle = `Settings | ${siteName}`

export function docsTitle(section: string) {
  return `Docs ${section} | ${siteName}`
}

export function docsDescription(section: string) {
  return `Documentation for the ${section} section of the head benchmark app.`
}

export function articleTitle(id: string) {
  return `Article ${id} | ${siteName}`
}

export function articleDescription(id: string) {
  return `Long-form article number ${id}, with a description sized like a realistic summary of the page content.`
}

export function rootHead() {
  return {
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { name: 'application-name', content: siteName },
      { name: 'description', content: 'Client head-management benchmark' },
      { name: 'theme-color', content: '#111827' },
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: siteName },
    ],
    links: [
      { rel: 'icon', href: '/favicon.ico' },
      { rel: 'preconnect', href: 'https://assets.example.com' },
    ],
  }
}

export function homeHead() {
  return {
    meta: [
      { title: homeTitle },
      { name: 'description', content: 'Landing page of the head benchmark' },
      { property: 'og:title', content: homeTitle },
    ],
    links: [{ rel: 'canonical', href: 'https://example.com/' }],
  }
}

export function docsLayoutHead() {
  return {
    meta: [
      // Overridden by the child section route on every docs navigation, so the
      // dedupe path is exercised for both `name` and `property` entries.
      { name: 'description', content: 'Documentation hub' },
      { property: 'og:title', content: `Docs | ${siteName}` },
      { name: 'docsearch:index', content: 'head-bench-docs' },
    ],
    links: [{ rel: 'search', href: '/docs/opensearch.xml' }],
  }
}

export function docsSectionHead(section: string) {
  return {
    meta: [
      { title: docsTitle(section) },
      { name: 'description', content: docsDescription(section) },
      { name: 'keywords', content: `docs,${section},router,benchmark` },
      { property: 'og:title', content: docsTitle(section) },
      { property: 'og:description', content: docsDescription(section) },
      { property: 'og:url', content: `https://example.com/docs/${section}` },
      { name: 'twitter:card', content: 'summary' },
      { name: 'twitter:title', content: docsTitle(section) },
    ],
    links: [
      { rel: 'canonical', href: `https://example.com/docs/${section}` },
      { rel: 'prev', href: `https://example.com/docs/${section}/intro` },
    ],
  }
}

export function articleHead(id: string) {
  return {
    meta: [
      { title: articleTitle(id) },
      { name: 'description', content: articleDescription(id) },
      { name: 'author', content: 'Bench Author' },
      { property: 'og:title', content: articleTitle(id) },
      { property: 'og:description', content: articleDescription(id) },
      { property: 'og:url', content: `https://example.com/articles/${id}` },
      { property: 'og:image', content: `https://example.com/covers/${id}.png` },
      { property: 'article:published_time', content: '2026-01-01T00:00:00Z' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: articleTitle(id) },
    ],
    links: [{ rel: 'canonical', href: `https://example.com/articles/${id}` }],
  }
}

export function settingsHead() {
  return {
    meta: [
      { title: settingsTitle },
      // Same names as root entries, so the child-wins dedupe path runs.
      { name: 'description', content: 'Account settings' },
      { name: 'theme-color', content: '#f9fafb' },
      { name: 'robots', content: 'noindex' },
    ],
    links: [],
  }
}

export const steps = [
  { testId: 'go-docs-api', title: docsTitle('api') },
  { testId: 'go-article-1', title: articleTitle('1') },
  { testId: 'go-docs-guide', title: docsTitle('guide') },
  { testId: 'go-settings', title: settingsTitle },
  { testId: 'go-article-2', title: articleTitle('2') },
  { testId: 'go-docs-cli', title: docsTitle('cli') },
  { testId: 'go-article-3', title: articleTitle('3') },
  { testId: 'go-home', title: homeTitle },
] as const

export const stepTestIds = steps.map((step) => step.testId)

export function assertStepResult(stepIndex: number) {
  const expected = steps[stepIndex]!.title
  if (document.title !== expected) {
    throw new Error(
      `Expected document.title to be "${expected}" after step ${stepIndex}, received "${document.title}"`,
    )
  }
}

// Two laps through the 8-step sequence per benchmark iteration.
export const ticksPerIteration = 16

export const benchOptions = {
  warmupIterations: 100,
  time: 10_000,
  throws: true,
}
