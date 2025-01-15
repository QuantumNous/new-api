import { getCurrentInstance, onUnmounted } from 'vue'
import { throwNoCurrentInstance } from './utils'
import { useRouter } from './globals'

export function onBeforeRouteUpdate (guard) {
  if (process.env.NODE_ENV !== 'production') {
    throwNoCurrentInstance('onBeforeRouteUpdate')
  }

  return useFilteredGuard(guard, isUpdateNavigation)
}
function isUpdateNavigation (to, from, depth) {
  const toMatched = to.matched
  const fromMatched = from.matched
  return (
    toMatched.length >= depth &&
    toMatched
      .slice(0, depth + 1)
      .every((record, i) => record === fromMatched[i])
  )
}

function isLeaveNavigation (to, from, depth) {
  const toMatched = to.matched
  const fromMatched = from.matched
  return toMatched.length < depth || toMatched[depth] !== fromMatched[depth]
}

export function onBeforeRouteLeave (guard) {
  if (process.env.NODE_ENV !== 'production') {
    throwNoCurrentInstance('onBeforeRouteLeave')
  }

  return useFilteredGuard(guard, isLeaveNavigation)
}

const noop = () => {}
function useFilteredGuard (guard, fn) {
  const instance = getCurrentInstance()
  const router = useRouter()

  let target = instance.proxy
  // find the nearest RouterView to know the depth
  while (
    target &&
    target.$vnode &&
    target.$vnode.data &&
    target.$vnode.data.routerViewDepth == null
  ) {
    target = target.$parent
  }

  const depth =
    target && target.$vnode && target.$vnode.data
      ? target.$vnode.data.routerViewDepth
      : null

  if (depth != null) {
    const removeGuard = router.beforeEach((to, from, next) => {
      return fn(to, from, depth) ? guard(to, from, next) : next()
    })

    onUnmounted(removeGuard)
    return removeGuard
  }

  return noop
}
