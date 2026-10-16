import { fileURLToPath } from 'node:url'
import path from 'pathe'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const defaultEntryDir = path.resolve(
  currentDir,
  '..',
  '..',
  'plugin',
  'default-entry',
)

export const solidStartDefaultEntryPaths = {
  client: path.resolve(defaultEntryDir, 'client.tsx'),
  server: path.resolve(defaultEntryDir, 'server.ts'),
  start: path.resolve(defaultEntryDir, 'start.ts'),
}
