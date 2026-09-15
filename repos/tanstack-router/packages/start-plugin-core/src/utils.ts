import path from 'node:path'

const isWindows: boolean =
  typeof process !== 'undefined' && process.platform === 'win32'
const windowsSlashRE = /\\/g

/** Read `build.rollupOptions` or `build.rolldownOptions` from a build config. */
export function getBundlerOptions(build: any): any {
  return build?.rolldownOptions ?? build?.rollupOptions
}

export function resolveViteId(id: string) {
  return `\0${id}`
}

export function createIdFilter(ids: Array<string>): RegExp {
  return new RegExp(`^(?:${ids.map(escapeRegExp).join('|')})$`)
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function createLogger(prefix: string) {
  const label = `[${prefix}]`
  return {
    log: (...args: any) => console.log(label, ...args),
    debug: (...args: any) => console.debug(label, ...args),
    info: (...args: any) => console.info(label, ...args),
    warn: (...args: any) => console.warn(label, ...args),
    error: (...args: any) => console.error(label, ...args),
  }
}

function slash(path: string): string {
  return path.replace(windowsSlashRE, '/')
}

export function normalizePath(id: string): string {
  return path.posix.normalize(isWindows ? slash(id) : id)
}
