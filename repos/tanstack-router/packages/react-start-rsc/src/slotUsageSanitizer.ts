import { isValidElement } from 'react'

const REACT_ELEMENT_TYPE = Symbol.for('react.element')
const REACT_TRANSITIONAL_ELEMENT_TYPE = Symbol.for('react.transitional.element')
const REACT_PORTAL_TYPE = Symbol.for('react.portal')

function isReactElementLike(value: unknown): boolean {
  if (!value || (typeof value !== 'object' && typeof value !== 'function')) {
    return false
  }

  // Prefer React's own check when available.
  if (isValidElement(value)) return true

  // Fallback: direct $$typeof detection (covers React 19 transitional elements).
  const t = (value as any).$$typeof
  return (
    t === REACT_ELEMENT_TYPE ||
    t === REACT_TRANSITIONAL_ELEMENT_TYPE ||
    t === REACT_PORTAL_TYPE
  )
}

const REACT_ELEMENT_PLACEHOLDER = 'React element'

function sanitizeSlotArg(
  value: unknown,
  seen: WeakSet<object>,
  depth: number,
): unknown {
  if (isReactElementLike(value)) {
    return REACT_ELEMENT_PLACEHOLDER
  }

  if (value === null || value === undefined) {
    return value
  }

  if (typeof value !== 'object' && typeof value !== 'function') {
    return value
  }

  if (Array.isArray(value)) {
    return value.map((d) => sanitizeSlotArg(d, seen, depth + 1))
  }

  const proto = Object.getPrototypeOf(value)
  if (proto === Object.prototype || proto === null) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = sanitizeSlotArg(v, seen, depth + 1)
    }
    return out
  }

  return value
}

export function sanitizeSlotArgs(args: Array<any>): Array<any> {
  const seen = new WeakSet<object>()
  return args.map((d) => sanitizeSlotArg(d, seen, 0))
}
