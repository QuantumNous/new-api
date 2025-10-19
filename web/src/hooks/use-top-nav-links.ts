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
        pricing?: { enabled: boolean; requireAuth: boolean }
        docs?: boolean
        about?: boolean
      }
    }
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  }, [status?.HeaderNavModules])

  // 文档链接（可能是外链）
  const docsLink: string | undefined = status?.docs_link

  const isAuthed = !!auth?.user

  const links: TopNavLink[] = []

  // Home
  if (modules?.home !== false) {
    links.push({ title: 'Home', href: '/' })
  }

  // Console -> /dashboard（新控制台路径）
  if (modules?.console !== false) {
    links.push({ title: 'Console', href: '/dashboard' })
  }

  // Pricing
  const pricing = modules?.pricing
  if (pricing && typeof pricing === 'object' && pricing.enabled) {
    const disabled = pricing.requireAuth && !isAuthed
    links.push({ title: 'Pricing', href: '/pricing', disabled })
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
