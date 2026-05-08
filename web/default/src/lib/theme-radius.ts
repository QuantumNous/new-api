import { useEffect, useState } from 'react'

export function resolveThemeRadiusPx(
  cssVariable = '--radius-md'
): number | undefined {
  if (typeof document === 'undefined') return undefined

  const probe = document.createElement('div')
  probe.style.borderRadius = `var(${cssVariable})`
  probe.style.pointerEvents = 'none'
  probe.style.position = 'absolute'
  probe.style.visibility = 'hidden'

  document.documentElement.appendChild(probe)
  const resolvedRadius = getComputedStyle(probe).borderTopLeftRadius
  probe.remove()

  const parsedRadius = Number.parseFloat(resolvedRadius)
  return Number.isFinite(parsedRadius) ? parsedRadius : undefined
}

export function useThemeRadiusPx(
  cssVariable = '--radius-md',
  refreshKey?: string
): number | undefined {
  const [radius, setRadius] = useState<number | undefined>()

  useEffect(() => {
    setRadius(resolveThemeRadiusPx(cssVariable))
  }, [cssVariable, refreshKey])

  return radius
}
