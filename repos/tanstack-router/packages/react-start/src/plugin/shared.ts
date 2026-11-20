import { fileURLToPath } from 'node:url'
import path from 'pathe'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
export const reactStartPluginDir = currentDir
const defaultEntryDir = path.resolve(
  currentDir,
  '..',
  '..',
  'plugin',
  'default-entry',
)

export const reactStartDefaultEntryPaths = {
  client: path.resolve(defaultEntryDir, 'client.tsx'),
  server: path.resolve(defaultEntryDir, 'server.ts'),
  start: path.resolve(defaultEntryDir, 'start.ts'),
}

export function resolvePackageEntryPath(packageName: string): string {
  return fileURLToPath(import.meta.resolve(packageName))
}
