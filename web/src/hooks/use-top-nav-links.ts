import { useMemo } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { useStatus } from '@/hooks/use-status'

export type TopNavLink = {
  title: string
  href: string
  disabled?: boolean
  external?: boolean
}

/**
 * 依据后端 /api/status 返回的 HeaderNavModules 配置生成顶部导航链接
 * 后端格式示例（字符串化 JSON）：
 * {
 *   home: true,
 *   console: true,
 *   pricing: { enabled: true, requireAuth: false },
 *   docs: true,
 *   about: true
 * }
 */
export function useTopNavLinks(): TopNavLink[] {
  const { status } = useStatus()
  const { auth } = useAuthStore()

  // 解析 HeaderNavModules
  const modules = useMemo(() => {
    const raw = status?.HeaderNavModules
    if (!raw) {
      return null as null | {
        home?: boolean
        console?: boolean
        pricing?: boolean | { enabled: boolean; requireAuth?: boolean }
        docs?: boolean
        about?: boolean
      }
    }
    try {
      const parsed = JSON.parse(raw)
      // 向后兼容：pricing 可能是 boolean
      if (typeof parsed?.pricing === 'boolean') {
        parsed.pricing = { enabled: parsed.pricing, requireAuth: false }
      }
      return parsed
    } catch {
      return null
    }
  }, [status?.HeaderNavModules])

  // 文档链接（可能是外链）
  const docsLink: string | undefined = status?.docs_link

  const isAuthed = !!auth?.user || !!auth?.accessToken

  const links: TopNavLink[] = []

  // Home
  if (modules?.home !== false) {
    links.push({ title: 'Home', href: '/' })
  }

  // Console -> /dashboard（新控制台路径）
  if (modules?.console !== false) {
    links.push({ title: 'Console', href: '/dashboard' })
  }

  // Models（旧称 pricing / 模型广场）
  const pricing = modules?.pricing
  const pricingEnabled =
    typeof pricing === 'object' ? !!pricing.enabled : pricing !== false
  const pricingRequireAuth =
    typeof pricing === 'object' ? !!pricing.requireAuth : false
  if (pricingEnabled) {
    const disabled = pricingRequireAuth && !isAuthed
    links.push({ title: 'Models', href: '/models', disabled })
  }

  // Docs（支持外链）
  if (modules?.docs !== false) {
    if (docsLink) {
      links.push({ title: 'Docs', href: docsLink, external: true })
    } else {
      links.push({ title: 'Docs', href: '/docs' })
    }
  }

  // About
  if (modules?.about !== false) {
    links.push({ title: 'About', href: '/about' })
  }

  return links
}
