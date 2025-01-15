import {
  getCurrentInstance,
  shallowReactive,
  effectScope
} from 'vue'
import { throwNoCurrentInstance } from './utils'

export function useRouter () {
  if (process.env.NODE_ENV !== 'production') {
    throwNoCurrentInstance('useRouter')
  }

  return getCurrentInstance().proxy.$root.$router
}

export function useRoute () {
  if (process.env.NODE_ENV !== 'production') {
    throwNoCurrentInstance('useRoute')
  }

  const root = getCurrentInstance().proxy.$root
  if (!root._$route) {
    const route = effectScope(true).run(() =>
      shallowReactive(Object.assign({}, root.$router.currentRoute))
    )
    root._$route = route

    root.$router.afterEach(to => {
      Object.assign(route, to)
    })
  }

  return root._$route
}
