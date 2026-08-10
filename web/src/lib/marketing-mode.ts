// 营销站域名隔离：www 子域名（或本地 ?marketing=1）进入营销前台，其余进入控制台。
// 与 P0 设计 ADR-1 一致；本地预览用 ?marketing=1，无需真实子域名。

export const MARKETING_HOST_PREFIX = 'www.'
export const CONSOLE_HOST_PREFIX = 'app.'

// 营销前台拥有的路径（与控制台 /、/pricing、/models 共用 URL，靠 host 区分）
export const MARKETING_PATHS = [
  '/',
  '/pricing',
  '/models',
  '/solutions',
  '/quick-start',
  '/contact-sales',
]

// 仅营销站独有的路径（控制台无对应页），需要跨域重定向到 www
const MARKETING_ONLY_PATHS = ['/solutions', '/quick-start', '/contact-sales']

export function isMarketingMode(): boolean {
  if (typeof window === 'undefined') return false
  const params = new URLSearchParams(window.location.search)
  if (params.get('marketing') === '1') return true
  return window.location.host.startsWith(MARKETING_HOST_PREFIX)
}

export function isMarketingPath(pathname: string): boolean {
  return MARKETING_PATHS.includes(pathname)
}

export function isMarketingOnlyPath(pathname: string): boolean {
  return MARKETING_ONLY_PATHS.includes(pathname)
}

function canSwitchHost(): boolean {
  const h = window.location.host
  return (
    !h.startsWith('localhost') &&
    !h.startsWith('127.0.0.1') &&
    h.includes('.')
  )
}

// 控制台内部路径（非营销路径、非静态资源）在营销域名下应跳回控制台域名
export function isConsolePath(pathname: string): boolean {
  if (isMarketingPath(pathname)) return false
  if (
    pathname.startsWith('/static') ||
    pathname.startsWith('/assets') ||
    pathname.startsWith('/api')
  )
    return false
  return true
}

// 将当前路径切换到目标域名（marketing=true→www，false→app）
export function toHostUrl(pathname: string, marketing: boolean): string {
  const cur = window.location.host
  const rest = cur.replace(/^(www\.|app\.)/, '')
  const prefix = marketing ? MARKETING_HOST_PREFIX : CONSOLE_HOST_PREFIX
  const proto = window.location.protocol
  return `${proto}//${prefix}${rest}${pathname}`
}

// 在 __root beforeLoad 中调用：处理 www↔app 跨域重定向（仅在真实域名下生效）
export function resolveMarketingHostRedirect(pathname: string): string | null {
  if (!canSwitchHost()) return null
  if (isMarketingMode()) {
    if (isConsolePath(pathname)) {
      return toHostUrl(pathname, false)
    }
  } else if (isMarketingOnlyPath(pathname)) {
    return toHostUrl(pathname, true)
  }
  return null
}
