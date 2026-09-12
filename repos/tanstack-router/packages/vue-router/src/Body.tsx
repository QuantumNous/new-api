import * as Vue from 'vue'

export const Body = Vue.defineComponent({
  name: 'Body',
  setup(_, { slots }) {
    const isServer = typeof window === 'undefined'

    return () => {
      const children = slots.default?.()

      if (isServer) {
        return Vue.h(
          'body',
          {},
          Vue.h(
            'div',
            { id: '__app' },
            Vue.h('div', { 'data-allow-mismatch': '' }, children),
          ),
        )
      }

      return Vue.h('div', { 'data-allow-mismatch': '' }, children)
    }
  },
})
