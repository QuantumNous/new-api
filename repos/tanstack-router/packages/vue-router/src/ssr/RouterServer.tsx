import * as Vue from 'vue'
import { Asset } from '../Asset'
import { useTags } from '../headContentUtils'
import { RouterProvider } from '../RouterProvider'
import { Scripts } from '../Scripts'
import type { AnyRouter, RouterManagedTag } from '@tanstack/router-core'

const ServerHeadContent = Vue.defineComponent({
  name: 'ServerHeadContent',
  setup() {
    const getTags = useTags()

    return () =>
      getTags().map((tag: RouterManagedTag) =>
        Vue.h(Asset, { key: tag.tag + (tag as any).id, ...tag }),
      )
  },
})

export const RouterServer = Vue.defineComponent({
  name: 'RouterServer',
  props: {
    router: {
      type: Object as () => AnyRouter,
      required: true,
    },
  },
  setup(props) {
    return () =>
      Vue.h('html', null, [
        Vue.h('head', null, [Vue.h(ServerHeadContent)]),
        Vue.h('body', null, [
          Vue.h('div', { id: '__app' }, [
            Vue.h(
              RouterProvider,
              {
                router: props.router,
              },
              {
                innerWrap: (innerProps: { children: any }) => [
                  Vue.h(ServerHeadContent),
                  innerProps.children,
                  Vue.h(Scripts),
                ],
              },
            ),
          ]),
        ]),
      ])
  },
})
