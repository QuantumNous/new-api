import { basename, dirname, extname, isAbsolute } from 'node:path'
import { resolveModulePath } from 'exsolve'

import { KNOWN_SOURCE_EXTENSIONS } from './constants'
import { normalizeFilePath } from './utils'

const FILE_RESOLUTION_EXTENSIONS = [...KNOWN_SOURCE_EXTENSIONS]

type DepKey = `file:${string}` | `dir:${string}`

/**
 * Canonicalize extensionless absolute IDs like `/src/foo.server` to the
 * physical file when possible.
 *
 * Keeps a small cache plus a reverse index so we can invalidate on HMR
 * updates without clearing the whole map.
 */
export class ExtensionlessAbsoluteIdResolver {
  private entries = new Map<string, { value: string; deps: Set<DepKey> }>()
  private keysByDep = new Map<DepKey, Set<string>>()

  clear(): void {
    this.entries.clear()
    this.keysByDep.clear()
  }

  /**
   * Invalidate any cached entries that might be affected by changes to `id`.
   * We invalidate both the file and its containing directory.
   */
  invalidateByFile(id: string): void {
    const file = normalizeFilePath(id)
    this.invalidateDep(`file:${file}`)
    if (isAbsolute(file)) {
      this.invalidateDep(`dir:${dirname(file)}`)
    }
  }

  resolve(id: string): string {
    const key = normalizeFilePath(id)
    const cached = this.entries.get(key)
    if (cached) return cached.value

    let result = key
    let resolvedPhysical: string | undefined

    if (isAbsolute(key)) {
      const ext = extname(key)
      if (!FILE_RESOLUTION_EXTENSIONS.includes(ext)) {
        const resolved = resolveModulePath(`./${basename(key)}`, {
          from: dirname(key),
          extensions: FILE_RESOLUTION_EXTENSIONS,
          try: true,
        })
        if (resolved) {
          resolvedPhysical = resolved
          result = normalizeFilePath(resolved)
        }
      }
    }

    const resolvedFile = resolvedPhysical
      ? normalizeFilePath(resolvedPhysical)
      : undefined

    const deps = this.buildDepsForKey(key, resolvedFile)
    this.entries.set(key, { value: result, deps })
    this.indexDeps(key, deps)
    return result
  }

  private invalidateDep(dep: DepKey): void {
    const keys = this.keysByDep.get(dep)
    if (!keys) return

    // Copy because deleting keys mutates indexes.
    for (const key of Array.from(keys)) {
      this.deleteKey(key)
    }
  }

  private buildDepsForKey(key: string, resolvedFile: string | undefined) {
    const deps = new Set<DepKey>()
    deps.add(`file:${key}`)

    if (isAbsolute(key)) {
      deps.add(`dir:${dirname(key)}`)
    }
    if (resolvedFile) {
      deps.add(`file:${resolvedFile}`)
    }

    return deps
  }

  private indexDeps(key: string, deps: Set<DepKey>): void {
    for (const dep of deps) {
      let keys = this.keysByDep.get(dep)
      if (!keys) {
        keys = new Set<string>()
        this.keysByDep.set(dep, keys)
      }
      keys.add(key)
    }
  }

  private deleteKey(key: string): void {
    const entry = this.entries.get(key)
    this.entries.delete(key)
    if (!entry) return

    for (const dep of entry.deps) {
      const keys = this.keysByDep.get(dep)
      if (!keys) continue
      keys.delete(key)
      if (keys.size === 0) {
        this.keysByDep.delete(dep)
      }
    }
  }
}
