import { existsSync, readFileSync, statSync } from 'node:fs'
import path, { dirname, resolve } from 'node:path'
import { glob } from 'tinyglobby'
// @ts-ignore Could not find a declaration file for module 'markdown-link-extractor'.
import markdownLinkExtractor from 'markdown-link-extractor'

type LinkError = {
  link: string
  reason: string
  resolvedPath: string
  source: string
}

const docsRoot = resolve('docs')
const examplesRoot = resolve('examples')

function isRelativeLink(link: string) {
  return (
    link &&
    !link.startsWith('/') &&
    !link.startsWith('http://') &&
    !link.startsWith('https://') &&
    !link.startsWith('//') &&
    !link.startsWith('#') &&
    !link.startsWith('mailto:')
  )
}

function isInside(root: string, target: string) {
  const relative = path.relative(root, target)
  return (
    relative === '' ||
    (!relative.startsWith('..') && !path.isAbsolute(relative))
  )
}

function stripHashAndQuery(link: string) {
  return link.split(/[?#]/)[0]
}

function examplePathFromRoute(route: string) {
  const match = route.match(/^framework\/([^/]+)\/examples\/(.+)$/)

  if (!match) {
    return null
  }

  return resolve(examplesRoot, match[1]!, match[2]!)
}

function fileExistsForMarkdownLink(
  link: string,
  markdownFile: string,
  errors: Array<LinkError>,
): boolean {
  const filePart = stripHashAndQuery(link)

  if (!filePart) {
    return true
  }

  let absPath = resolve(dirname(resolve(markdownFile)), filePart)

  if (!isInside(docsRoot, absPath)) {
    errors.push({
      link,
      reason: 'navigates outside docs',
      resolvedPath: absPath,
      source: markdownFile,
    })
    return false
  }

  const docsRelativePath = path
    .relative(docsRoot, absPath)
    .replaceAll(path.sep, '/')
  const examplePath = examplePathFromRoute(docsRelativePath)

  if (examplePath) {
    const exists =
      existsSync(examplePath) && statSync(examplePath).isDirectory()

    if (!exists) {
      errors.push({
        link,
        reason: 'example route not found',
        resolvedPath: examplePath,
        source: markdownFile,
      })
    }

    return exists
  }

  if (!path.extname(absPath)) {
    absPath = `${absPath}.md`
  }

  const exists = existsSync(absPath)

  if (!exists) {
    errors.push({
      link,
      reason: 'not found',
      resolvedPath: absPath,
      source: markdownFile,
    })
  }

  return exists
}

function getConfigRoutes(value: unknown, routes = new Set<string>()) {
  if (Array.isArray(value)) {
    value.forEach((child) => getConfigRoutes(child, routes))
    return routes
  }

  if (!value || typeof value !== 'object') {
    return routes
  }

  const record = value as Record<string, unknown>

  if (typeof record.to === 'string') {
    routes.add(record.to)
  }

  Object.values(record).forEach((child) => getConfigRoutes(child, routes))

  return routes
}

function fileExistsForConfigRoute(
  route: string,
  errors: Array<LinkError>,
): boolean {
  const cleanRoute = stripHashAndQuery(route)
    .replace(/^\.\//, '')
    .replace(/\.md$/, '')

  if (!cleanRoute || cleanRoute.startsWith('http')) {
    return true
  }

  const examplePath = examplePathFromRoute(cleanRoute)
  const resolvedPath = examplePath ?? resolve(docsRoot, `${cleanRoute}.md`)
  const exists = examplePath
    ? existsSync(resolvedPath) && statSync(resolvedPath).isDirectory()
    : existsSync(resolvedPath)

  if (!exists) {
    errors.push({
      link: route,
      reason: examplePath ? 'example route not found' : 'docs route not found',
      resolvedPath,
      source: 'docs/config.json',
    })
  }

  return exists
}

function extractHref(link: unknown) {
  if (typeof link === 'string') {
    return link
  }

  if (
    link &&
    typeof link === 'object' &&
    'href' in link &&
    typeof link.href === 'string'
  ) {
    return link.href
  }

  return null
}

async function verifyLinks() {
  const markdownFiles = await glob('docs/**/*.md', {
    ignore: ['**/node_modules/**'],
  })

  console.log(`Found ${markdownFiles.length} markdown files\n`)

  const errors: Array<LinkError> = []

  for (const file of markdownFiles) {
    const content = readFileSync(file, 'utf-8')
    const links: Array<unknown> = markdownLinkExtractor(content)

    links.forEach((link) => {
      const href = extractHref(link)

      if (href && isRelativeLink(href)) {
        fileExistsForMarkdownLink(href, file, errors)
      }
    })
  }

  const config = JSON.parse(readFileSync('docs/config.json', 'utf-8'))
  const configRoutes = getConfigRoutes(config)

  configRoutes.forEach((route) => {
    fileExistsForConfigRoute(route, errors)
  })

  const expectedExampleRoutes = new Set(
    (await glob('examples/*/*/package.json')).map((packageJson) => {
      const [, framework, example] = packageJson.split('/')
      return `framework/${framework}/examples/${example}`
    }),
  )

  expectedExampleRoutes.forEach((route) => {
    if (!configRoutes.has(route)) {
      errors.push({
        link: route,
        reason: 'example missing from docs config',
        resolvedPath: resolve('docs/config.json'),
        source: route.replace(
          /^framework\/([^/]+)\/examples\/(.+)$/,
          'examples/$1/$2/package.json',
        ),
      })
    }
  })

  if (errors.length > 0) {
    console.log(`\nFound ${errors.length} broken links or routes:`)
    errors.forEach((err) => {
      console.log(
        `${err.link}\n  in:    ${err.source}\n  path:  ${err.resolvedPath}\n  why:   ${err.reason}\n`,
      )
    })
    process.exit(1)
  } else {
    console.log('\nNo broken links or routes found!')
  }
}

verifyLinks().catch(console.error)
