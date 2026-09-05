import path from 'node:path'
import { existsSync, readFileSync } from 'node:fs'
import { z } from 'zod'
import { virtualRootRouteSchema } from './filesystem/virtual/config'
import type { GeneratorPlugin } from './plugin/types'

const tokenJsonRegexSchema = z.object({
  regex: z.string(),
  flags: z.string().optional(),
})

const tokenMatcherSchema = z.union([
  z.string(),
  z.instanceof(RegExp),
  tokenJsonRegexSchema,
])

export type TokenMatcherJson = string | z.infer<typeof tokenJsonRegexSchema>

export type TokenMatcher = z.infer<typeof tokenMatcherSchema>

export const baseConfigSchema = z.object({
  target: z.enum(['react', 'solid', 'vue']).optional().default('react'),
  virtualRouteConfig: virtualRootRouteSchema.or(z.string()).optional(),
  routeFilePrefix: z.string().optional(),
  routeFileIgnorePrefix: z.string().optional().default('-'),
  routeFileIgnorePattern: z.string().optional(),
  routesDirectory: z.string().optional().default('./src/routes'),
  quoteStyle: z.enum(['single', 'double']).optional().default('single'),
  semicolons: z.boolean().optional().default(false),
  disableLogging: z.boolean().optional().default(false),
  routeTreeFileHeader: z
    .array(z.string())
    .optional()
    .default([
      '/* eslint-disable */',
      '// @ts-nocheck',
      '// noinspection JSUnusedGlobalSymbols',
    ]),
  indexToken: tokenMatcherSchema.optional().default('index'),
  routeToken: tokenMatcherSchema.optional().default('route'),
  pathParamsAllowedCharacters: z
    .array(z.enum([';', ':', '@', '&', '=', '+', '$', ',']))
    .optional(),
})

export type BaseConfig = z.infer<typeof baseConfigSchema>

export const configSchema = baseConfigSchema.extend({
  generatedRouteTree: z.string().optional().default('./src/routeTree.gen.ts'),
  disableTypes: z.boolean().optional().default(false),
  addExtensions: z
    .union([z.boolean(), z.string()])
    .optional()
    .default(false)
    .transform((v) =>
      typeof v === 'string' ? (v.startsWith('.') ? v : `.${v}`) : v,
    ),
  enableRouteTreeFormatting: z.boolean().optional().default(true),
  routeTreeFileFooter: z
    .union([
      z.array(z.string()).optional().default([]),
      z.custom<() => Array<string>>((value) => typeof value === 'function'),
    ])
    .optional(),
  autoCodeSplitting: z.boolean().optional(),
  customScaffolding: z
    .object({
      routeTemplate: z.string().optional(),
      lazyRouteTemplate: z.string().optional(),
    })
    .optional(),
  experimental: z
    .object({
      // TODO: This has been made stable and is now "autoCodeSplitting". Remove in next major version.
      enableCodeSplitting: z.boolean().optional(),
    })
    .optional(),
  plugins: z.array(z.custom<GeneratorPlugin>()).optional(),
  tmpDir: z.string().optional().default(''),
  importRoutesUsingAbsolutePaths: z.boolean().optional().default(false),
})

export type Config = z.infer<typeof configSchema>

type ResolveParams = {
  configDirectory: string
}

export function resolveConfigPath({ configDirectory }: ResolveParams) {
  return path.resolve(configDirectory, 'tsr.config.json')
}

export function getConfig(
  inlineConfig: Partial<Config> = {},
  configDirectory?: string,
): Config {
  if (configDirectory === undefined) {
    configDirectory = process.cwd()
  }
  const configFilePathJson = resolveConfigPath({ configDirectory })
  const exists = existsSync(configFilePathJson)

  let config: Config

  if (exists) {
    // Parse file config (allows JSON regex-object form)
    const fileConfigRaw = JSON.parse(readFileSync(configFilePathJson, 'utf-8'))

    // Merge raw configs (inline overrides file), then parse once to apply defaults
    // This ensures file config values aren't overwritten by inline defaults
    const merged = {
      ...fileConfigRaw,
      ...inlineConfig,
    }
    config = configSchema.parse(merged)
  } else {
    config = configSchema.parse(inlineConfig)
  }

  // If typescript is disabled, make sure the generated route tree is a .js file
  if (config.disableTypes) {
    config.generatedRouteTree = config.generatedRouteTree.replace(
      /\.(ts|tsx)$/,
      '.js',
    )
  }

  // if a configDirectory is used, paths should be relative to that directory
  if (configDirectory) {
    // if absolute configDirectory is provided, use it as the root
    if (path.isAbsolute(configDirectory)) {
      config.routesDirectory = path.resolve(
        configDirectory,
        config.routesDirectory,
      )
      config.generatedRouteTree = path.resolve(
        configDirectory,
        config.generatedRouteTree,
      )
    } else {
      config.routesDirectory = path.resolve(
        process.cwd(),
        configDirectory,
        config.routesDirectory,
      )
      config.generatedRouteTree = path.resolve(
        process.cwd(),
        configDirectory,
        config.generatedRouteTree,
      )
    }
  }

  const resolveTmpDir = (dir: string | Array<string>) => {
    if (Array.isArray(dir)) {
      dir = path.join(...dir)
    }
    if (!path.isAbsolute(dir)) {
      dir = path.resolve(process.cwd(), dir)
    }
    return dir
  }

  if (config.tmpDir) {
    config.tmpDir = resolveTmpDir(config.tmpDir)
  } else if (process.env.TSR_TMP_DIR) {
    config.tmpDir = resolveTmpDir(process.env.TSR_TMP_DIR)
  } else {
    config.tmpDir = resolveTmpDir(['.tanstack', 'tmp'])
  }

  validateConfig(config)
  return config
}

function validateConfig(config: Config) {
  if (typeof config.experimental?.enableCodeSplitting !== 'undefined') {
    const message = `
------
⚠️ ⚠️ ⚠️
ERROR: The "experimental.enableCodeSplitting" flag has been made stable and is now "autoCodeSplitting". Please update your configuration file to use "autoCodeSplitting" instead of "experimental.enableCodeSplitting".
------
`
    console.error(message)
    throw new Error(message)
  }

  // Check that indexToken and routeToken are not identical
  // Works for strings, RegExp, and JSON regex objects
  if (areTokensEqual(config.indexToken, config.routeToken)) {
    throw new Error(
      `The "indexToken" and "routeToken" options must be different.`,
    )
  }

  if (
    config.routeFileIgnorePrefix &&
    config.routeFileIgnorePrefix.trim() === '_'
  ) {
    throw new Error(
      `The "routeFileIgnorePrefix" cannot be an underscore ("_"). This is a reserved character used to denote a pathless route. Please use a different prefix.`,
    )
  }

  return config
}

/**
 * Compares two token matchers for equality.
 * Handles strings, RegExp instances, and JSON regex objects.
 */
function areTokensEqual(a: TokenMatcher, b: TokenMatcher): boolean {
  // Both strings
  if (typeof a === 'string' && typeof b === 'string') {
    return a === b
  }

  // Both RegExp instances
  if (a instanceof RegExp && b instanceof RegExp) {
    return a.source === b.source && a.flags === b.flags
  }

  // Both JSON regex objects
  if (
    typeof a === 'object' &&
    'regex' in a &&
    typeof b === 'object' &&
    'regex' in b
  ) {
    return a.regex === b.regex && (a.flags ?? '') === (b.flags ?? '')
  }

  // Mixed types - not equal
  return false
}
