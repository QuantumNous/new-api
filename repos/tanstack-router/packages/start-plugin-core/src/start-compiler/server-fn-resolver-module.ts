import type { ServerFn } from './types'

interface ResolverManifestEntry {
  id: string
  functionName: string
  extractedFilename: string
  isClientReferenced: boolean
}

interface GenerateServerFnResolverModuleOptions {
  serverFnsById: Record<string, ServerFn>
  includeClientReferencedCheck: boolean
  useStaticImports?: boolean
}

function getResolverManifestEntries(
  serverFnsById: Record<string, ServerFn>,
): Array<ResolverManifestEntry> {
  return (
    Object.entries(serverFnsById)
      // Sort entries by ID so that the generated manifest has a stable, deterministic order.
      // Non-deterministic ordering causes the compiled hash of the same source file to change
      // between builds, breaking content-addressed caching and reproducible deployments.
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([id, fn]) => ({
        id,
        functionName: fn.functionName,
        extractedFilename: fn.extractedFilename,
        isClientReferenced: fn.isClientReferenced ?? true,
      }))
  )
}

function getClientReferencedCheck(
  includeClientReferencedCheck: boolean,
): string {
  if (!includeClientReferencedCheck) {
    return ''
  }

  return `
  if (access.origin === 'client' && !serverFnInfo.isClientReferenced) {
    throw new Error('Server function not accessible from client: ' + id)
  }
`
}

function getResolverBody(): string {
  return `
export async function getServerFnById(id, access) {
  const serverFnInfo = manifest[id]
  if (!serverFnInfo) {
    throw new Error('Server function info not found for ' + id)
  }
__CLIENT_REFERENCED_CHECK__
  const fnModule = serverFnInfo.module ?? (await serverFnInfo.importer())
  if (!fnModule) {
    throw new Error('Server function module not resolved for ' + id)
  }
  const action = fnModule[serverFnInfo.functionName]
  if (!action) {
    throw new Error('Server function module export not resolved for serverFn ID: ' + id)
  }
  return action
}
`
}

function getResolverManifestModuleAccess(opts: {
  useStaticImports?: boolean
  extractedFilename: string
  moduleRef: string
}): string {
  if (opts.useStaticImports) {
    return `module: ${opts.moduleRef}`
  }

  return `importer: () => import(${JSON.stringify(opts.extractedFilename)})`
}

function getResolverManifestEntry(opts: {
  entry: ResolverManifestEntry
  moduleAccess: string
  includeClientReferencedCheck: boolean
}): string {
  const clientReferenced = opts.includeClientReferencedCheck
    ? `,\n    isClientReferenced: ${opts.entry.isClientReferenced}`
    : ''

  return `'${opts.entry.id}': {
    functionName: '${opts.entry.functionName}',
    ${opts.moduleAccess}${clientReferenced}
  }`
}

export function generateServerFnResolverModule(
  opts: GenerateServerFnResolverModuleOptions,
): string {
  const manifestEntries = getResolverManifestEntries(opts.serverFnsById)
  const staticImports: Array<string> = []

  const manifest = manifestEntries
    .map((entry, index) => {
      const moduleRef = `serverFnModule${index}`

      if (opts.useStaticImports) {
        staticImports.push(
          `import * as ${moduleRef} from ${JSON.stringify(entry.extractedFilename)}`,
        )
      }

      return getResolverManifestEntry({
        entry,
        moduleAccess: getResolverManifestModuleAccess({
          useStaticImports: opts.useStaticImports,
          extractedFilename: entry.extractedFilename,
          moduleRef,
        }),
        includeClientReferencedCheck: opts.includeClientReferencedCheck,
      })
    })
    .join(',\n  ')

  const body = getResolverBody().replace(
    '__CLIENT_REFERENCED_CHECK__',
    getClientReferencedCheck(opts.includeClientReferencedCheck),
  )

  return `
${staticImports.join('\n')}
const manifest = {
  ${manifest}
}
${body}
`
}
