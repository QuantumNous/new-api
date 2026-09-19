import * as Vue from 'vue'
import { Matches } from './Matches'
import { provideRouter } from './routerContext'
import type {
  AnyRouter,
  RegisteredRouter,
  RouterOptions,
} from '@tanstack/router-core'

// Component that provides router context and renders children
export const RouterContextProvider = Vue.defineComponent({
  name: 'RouterContextProvider',
  props: {
    router: {
      type: Object,
      required: true,
    },
    // Rest of router options will be passed as attrs
  },
  setup(props, { attrs, slots }) {
    const router = props.router as AnyRouter
    const restAttrs = attrs

    // Allow the router to update options on the router instance
    router.update({
      ...router.options,
      ...restAttrs,
      context: {
        ...router.options.context,
        ...(restAttrs.context || {}),
      },
    })

    // Provide router to all child components
    provideRouter(router)

    return () => {
      // Get child content
      const childContent = slots.default?.()

      // If a Wrap component is specified in router options, use it
      if (router.options.Wrap) {
        const WrapComponent = router.options.Wrap
        return Vue.h(WrapComponent, null, () => childContent)
      }

      // Unwrap single-element arrays to avoid implicit Fragment
      // that would cause hydration mismatch
      if (Array.isArray(childContent) && childContent.length === 1) {
        return childContent[0]
      }

      // Otherwise just return the child content
      return childContent
    }
  },
})

// The main router provider component that includes matches
export const RouterProvider = Vue.defineComponent({
  name: 'RouterProvider',
  props: {
    router: {
      type: Object,
      required: true,
    },
    // Rest of router options will be passed as attrs
  },
  setup(props, { attrs }) {
    const restAttrs = attrs

    return () => {
      return Vue.h(
        RouterContextProvider,
        {
          router: props.router,
          ...restAttrs,
        },
        {
          default: () => Vue.h(Matches),
        },
      )
    }
  },
}) as unknown as {
  <TRouter extends AnyRouter = RegisteredRouter>(
    props: {
      router: TRouter
      routeTree?: TRouter['routeTree']
    } & Record<string, any>,
  ): Vue.VNode
  new (): {
    $props: {
      router: AnyRouter
      routeTree?: AnyRouter['routeTree']
    }
  }
}

export type RouterProps<
  TRouter extends AnyRouter = RegisteredRouter,
  TDehydrated extends Record<string, any> = Record<string, any>,
> = Omit<
  RouterOptions<
    TRouter['routeTree'],
    NonNullable<TRouter['options']['trailingSlash']>,
    false,
    TRouter['history'],
    TDehydrated
  >,
  'context'
> & {
  router: TRouter
  context?: Partial<
    RouterOptions<
      TRouter['routeTree'],
      NonNullable<TRouter['options']['trailingSlash']>,
      false,
      TRouter['history'],
      TDehydrated
    >['context']
  >
}
