import type { ImportProtectionEnvRules } from '../schema'
import type { Pattern } from './utils'

export interface DefaultImportProtectionRules {
  client: Required<ImportProtectionEnvRules>
  server: Required<ImportProtectionEnvRules>
}

const frameworks = ['react', 'solid', 'vue'] as const

/**
 * Returns the default import protection rules.
 *
 * All three framework variants are always included so that, e.g., a React
 * project also denies `@tanstack/solid-start/server` imports.
 */
export function getDefaultImportProtectionRules(): DefaultImportProtectionRules {
  const clientSpecifiers: Array<Pattern> = frameworks.map(
    (fw) => `@tanstack/${fw}-start/server`,
  )

  return {
    client: {
      specifiers: clientSpecifiers,
      files: ['**/*.server.*'],
      excludeFiles: ['**/node_modules/**'],
    },
    server: {
      specifiers: [],
      files: ['**/*.client.*'],
      excludeFiles: ['**/node_modules/**'],
    },
  }
}

/**
 * Marker module specifiers that restrict a file to a specific environment.
 */
export function getMarkerSpecifiers(): {
  serverOnly: Array<string>
  clientOnly: Array<string>
} {
  return {
    serverOnly: frameworks.map((fw) => `@tanstack/${fw}-start/server-only`),
    clientOnly: frameworks.map((fw) => `@tanstack/${fw}-start/client-only`),
  }
}
