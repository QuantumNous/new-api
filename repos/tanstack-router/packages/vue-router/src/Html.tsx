import * as Vue from 'vue'
import { Body } from './Body'

export const Html = Vue.defineComponent({
  name: 'Html',
  setup(_, { slots }) {
    const isServer = typeof window === 'undefined'

    const hydrated = Vue.ref(false)

    if (!isServer) {
      Vue.onMounted(() => {
        hydrated.value = true
      })
    }

    return () => {
      if (isServer) {
        return Vue.h('html', {}, slots.default?.())
      }

      const children = slots.default?.() || []
      const flatChildren = Array.isArray(children) ? children : [children]
      let bodyVnode: Vue.VNode | null = null
      const headChildren: Array<Vue.VNode> = []

      for (const child of flatChildren) {
        if (typeof child === 'object' && child !== null) {
          const vnode = child
          if (vnode.type === 'head') {
            if (vnode.children) {
              if (Array.isArray(vnode.children)) {
                for (const c of vnode.children) {
                  if (typeof c === 'object' && c !== null && 'type' in c) {
                    headChildren.push(c)
                  }
                }
              }
            }
            continue
          }
          if (vnode.type === Body) {
            bodyVnode = vnode
            continue
          }
          if (!bodyVnode) {
            bodyVnode = vnode
          }
        }
      }

      const result: Array<Vue.VNode> = []

      if (bodyVnode) {
        result.push(bodyVnode)
      }

      if (hydrated.value && headChildren.length > 0) {
        result.push(Vue.h(Vue.Teleport, { to: 'head' }, headChildren))
      }

      return result.length === 1 ? result[0] : Vue.h(Vue.Fragment, result)
    }
  },
})
