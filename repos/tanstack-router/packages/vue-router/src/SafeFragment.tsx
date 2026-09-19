import * as Vue from 'vue'

export const SafeFragment = Vue.defineComponent({
  name: 'SafeFragment',
  setup(_, { slots }) {
    return () => {
      return Vue.h(Vue.Fragment, null, slots.default?.())
    }
  },
})
