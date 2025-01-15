import { computed, unref } from 'vue'
import { guardEvent } from '../components/link'
import { throwNoCurrentInstance } from './utils'
import { useRouter, useRoute } from './globals'

function includesParams (outer, inner) {
  for (const key in inner) {
    const innerValue = inner[key]
    const outerValue = outer[key]
    if (typeof innerValue === 'string') {
      if (innerValue !== outerValue) return false
    } else {
      if (
        !Array.isArray(outerValue) ||
        outerValue.length !== innerValue.length ||
        innerValue.some((value, i) => value !== outerValue[i])
      ) {
        return false
      }
    }
  }

  return true
}

// helpers from vue router 4

function isSameRouteLocationParamsValue (a, b) {
  return Array.isArray(a)
    ? isEquivalentArray(a, b)
    : Array.isArray(b)
      ? isEquivalentArray(b, a)
      : a === b
}

function isEquivalentArray (a, b) {
  return Array.isArray(b)
    ? a.length === b.length && a.every((value, i) => value === b[i])
    : a.length === 1 && a[0] === b
}

export function isSameRouteLocationParams (a, b) {
  if (Object.keys(a).length !== Object.keys(b).length) return false

  for (const key in a) {
    if (!isSameRouteLocationParamsValue(a[key], b[key])) return false
  }

  return true
}

export function useLink (props) {
  if (process.env.NODE_ENV !== 'production') {
    throwNoCurrentInstance('useLink')
  }

  const router = useRouter()
  const currentRoute = useRoute()

  const resolvedRoute = computed(() => router.resolve(unref(props.to), currentRoute))

  const activeRecordIndex = computed(() => {
    const route = resolvedRoute.value.route
    const { matched } = route
    const { length } = matched
    const routeMatched = matched[length - 1]
    const currentMatched = currentRoute.matched
    if (!routeMatched || !currentMatched.length) return -1
    const index = currentMatched.indexOf(routeMatched)
    if (index > -1) return index
    // possible parent record
    const parentRecord = currentMatched[currentMatched.length - 2]

    return (
      // we are dealing with nested routes
      length > 1 &&
        // if the parent and matched route have the same path, this link is
        // referring to the empty child. Or we currently are on a different
        // child of the same parent
        parentRecord && parentRecord === routeMatched.parent
    )
  })

  const isActive = computed(
    () =>
      activeRecordIndex.value > -1 &&
      includesParams(currentRoute.params, resolvedRoute.value.route.params)
  )
  const isExactActive = computed(
    () =>
      activeRecordIndex.value > -1 &&
      activeRecordIndex.value === currentRoute.matched.length - 1 &&
      isSameRouteLocationParams(currentRoute.params, resolvedRoute.value.route.params)
  )

  const navigate = e => {
    const href = resolvedRoute.value.route
    if (guardEvent(e)) {
      return props.replace
        ? router.replace(href)
        : router.push(href)
    }
    return Promise.resolve()
  }

  return {
    href: computed(() => resolvedRoute.value.href),
    route: computed(() => resolvedRoute.value.route),
    isExactActive,
    isActive,
    navigate
  }
}
