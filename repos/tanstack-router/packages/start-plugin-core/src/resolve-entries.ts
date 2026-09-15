import { resolveModulePath } from 'exsolve'

interface ResolveModuleOptions {
  baseName: string
  from: string
}
function resolveModule(opts: ResolveModuleOptions): string | undefined {
  let baseName = opts.baseName
  if (!baseName.startsWith('./')) {
    baseName = `./${baseName}`
  }
  return resolveModulePath(baseName, {
    from: opts.from,
    extensions: ['.ts', '.js', '.mts', '.mjs', '.tsx', '.jsx'],
    try: true,
  })
}

export function resolveEntry<
  TRequired extends boolean,
  TReturn = TRequired extends true ? string : string | undefined,
>(opts: {
  type: string
  configuredEntry?: string
  defaultEntry: string
  resolvedSrcDirectory: string
  required: TRequired
}): TReturn {
  let resolveOptions: ResolveModuleOptions

  // if entry was not configured, use default relative to srcDirectory
  if (!opts.configuredEntry) {
    resolveOptions = {
      baseName: opts.defaultEntry,
      from: opts.resolvedSrcDirectory,
    }
  } else {
    resolveOptions = {
      baseName: opts.configuredEntry,
      from: opts.resolvedSrcDirectory,
    }
  }

  const resolvedEntry = resolveModule(resolveOptions)
  if (opts.required && !resolvedEntry) {
    throw new Error(
      `Could not resolve entry for ${opts.type}: ${resolveOptions.baseName} in ${resolveOptions.from}`,
    )
  }
  return resolvedEntry as TReturn
}
