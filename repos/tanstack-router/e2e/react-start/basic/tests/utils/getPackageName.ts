import { readFileSync } from 'node:fs'
import { join } from 'node:path'

let packageName: string | undefined

export function getPackageName() {
  if (!packageName) {
    const packageJson = JSON.parse(
      readFileSync(join(process.cwd(), 'package.json'), 'utf-8'),
    ) as { name: string }

    packageName = packageJson.name
  }

  return packageName
}
