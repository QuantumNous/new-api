/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTheme } from '@/context/theme-provider'
import { useNotifications } from '@/hooks/use-notifications'
import { getModelStatus } from '@/features/model-status/api'
import { buildModelStatusView } from '@/features/model-status/lib/status-view'
import type { ModelStatusHealth } from '@/features/model-status/types'
import { codeExamples, type CodeExampleKey } from './content'

export function useStaticHomeTheme() {
  const { resolvedTheme, setTheme } = useTheme()
  const [animating, setAnimating] = useState(false)
  const [revealTheme, setRevealTheme] = useState(resolvedTheme)
  const commitTimer = useRef<number | null>(null)
  const revealTimer = useRef<number | null>(null)
  const switchTimer = useRef<number | null>(null)
  const supportsViewTransition =
    typeof document !== 'undefined' && 'startViewTransition' in document

  const clearTimers = useCallback(() => {
    if (commitTimer.current !== null) window.clearTimeout(commitTimer.current)
    if (revealTimer.current !== null) window.clearTimeout(revealTimer.current)
    if (switchTimer.current !== null) window.clearTimeout(switchTimer.current)
    commitTimer.current = null
    revealTimer.current = null
    switchTimer.current = null
  }, [])

  const applyRevealVars = useCallback(
    (nextTheme: 'dark' | 'light', trigger?: HTMLElement | null) => {
      const rect = trigger?.getBoundingClientRect()
      const x = rect ? rect.left + rect.width / 2 : window.innerWidth - 48
      const y = rect ? rect.top + rect.height / 2 : 32
      const radius = Math.ceil(
        Math.hypot(
          Math.max(x, window.innerWidth - x),
          Math.max(y, window.innerHeight - y)
        )
      )
      const root = document.documentElement
      const color = nextTheme === 'light' ? 'rgba(248, 250, 251, 0.98)' : 'rgba(17, 19, 21, 0.98)'

      root.style.setProperty('--home-theme-reveal-x', `${x}px`)
      root.style.setProperty('--home-theme-reveal-y', `${y}px`)
      root.style.setProperty('--home-theme-reveal-radius', `${radius}px`)
      root.style.setProperty('--home-theme-reveal-diameter', `${radius * 2}px`)
      root.style.setProperty('--home-theme-reveal-color', color)
    },
    []
  )

  const toggleTheme = useCallback(
    (trigger?: HTMLElement | null) => {
      clearTimers()

      const nextTheme = resolvedTheme === 'dark' ? 'light' : 'dark'
      const reduceMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)'
      ).matches

      setRevealTheme(nextTheme)
      applyRevealVars(nextTheme, trigger)

      if (reduceMotion) {
        setTheme(nextTheme)
        return
      }

      setAnimating(true)
      switchTimer.current = window.setTimeout(() => setAnimating(false), 840)

      if (supportsViewTransition) {
        document.startViewTransition(() => setTheme(nextTheme))
        return
      }

      commitTimer.current = window.setTimeout(() => setTheme(nextTheme), 522)
      revealTimer.current = window.setTimeout(() => setAnimating(false), 900)
    },
    [applyRevealVars, clearTimers, resolvedTheme, setTheme, supportsViewTransition]
  )

  useEffect(() => () => clearTimers(), [clearTimers])

  return {
    animating,
    isDark: resolvedTheme === 'dark',
    revealTheme,
    supportsViewTransition,
    transitionMode: supportsViewTransition ? 'view' : 'fallback',
    theme: resolvedTheme,
    toggleTheme,
  }
}

export function useCopyToast() {
  const [message, setMessage] = useState('')

  const copy = useCallback(async (value: string, successMessage: string) => {
    await navigator.clipboard.writeText(value)
    setMessage(successMessage)
    window.setTimeout(() => setMessage(''), 1800)
  }, [])

  return { copy, message }
}

export function useCodeExample() {
  const [activeKey, setActiveKey] = useState<CodeExampleKey>('curl')
  return {
    activeKey,
    code: codeExamples[activeKey],
    keys: Object.keys(codeExamples) as CodeExampleKey[],
    setActiveKey,
  }
}

export function useHomeAnnouncement() {
  const notifications = useNotifications()
  const announcement = useMemo(() => {
    const item = notifications.announcements[0]
    if (!item) return null
    return {
      title:
        stringValue(item.title) ||
        stringValue(item.content) ||
        stringValue(item.extra),
      date: stringValue(item.publishDate) || stringValue(item.date),
      type: stringValue(item.type),
    }
  }, [notifications.announcements])

  return {
    announcement,
    error: false,
    loading: notifications.loading,
    notifications,
  }
}

export function useHomeModelStatus() {
  const query = useQuery({
    queryKey: ['home-model-status'],
    queryFn: getModelStatus,
    staleTime: 1000 * 60,
  })

  const view = useMemo(() => buildModelStatusView(query.data), [query.data])
  const models = useMemo(
    () => view.groups.flatMap((group) => group.models).slice(0, 8),
    [view.groups]
  )

  return {
    error: query.isError,
    loading: query.isLoading,
    models,
    summary: view.summary,
  }
}

export function useScrollReveal() {
  useEffect(() => {
    const elements = Array.from(
      document.querySelectorAll<HTMLElement>('[data-home-reveal]')
    )
    if (elements.length === 0) return

    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches
    if (reduceMotion) {
      elements.forEach((element) => element.classList.add('is-visible'))
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.classList.add('is-visible')
          observer.unobserve(entry.target)
        }
      },
      { threshold: 0.16 }
    )

    elements.forEach((element, index) => {
      element.style.setProperty('--home-reveal-delay', `${index * 58}ms`)
      observer.observe(element)
    })

    return () => observer.disconnect()
  }, [])
}

export function healthLabelClass(health: ModelStatusHealth) {
  if (health === 'up') return 'home-status--up'
  if (health === 'degraded') return 'home-status--degraded'
  if (health === 'down') return 'home-status--down'
  return 'home-status--unknown'
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}
