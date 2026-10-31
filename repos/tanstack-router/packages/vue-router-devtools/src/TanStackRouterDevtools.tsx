import { TanStackRouterDevtoolsCore } from '@tanstack/router-devtools-core'
import { defineComponent, h, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter, useRouterState } from '@tanstack/vue-router'
import type { AnyRouter } from '@tanstack/vue-router'

export interface TanStackRouterDevtoolsOptions {
  /**
   * Set this true if you want the dev tools to default to being open
   */
  initialIsOpen?: boolean
  /**
   * Use this to add props to the panel. For example, you can add className, style (merge and override default style), etc.
   */
  panelProps?: Record<string, any>
  /**
   * Use this to add props to the close button. For example, you can add className, style (merge and override default style), onClick (extend default handler), etc.
   */
  closeButtonProps?: Record<string, any>
  /**
   * Use this to add props to the toggle button. For example, you can add className, style (merge and override default style), onClick (extend default handler), etc.
   */
  toggleButtonProps?: Record<string, any>
  /**
   * The position of the TanStack Router logo to open and close the devtools panel.
   * Defaults to 'bottom-left'.
   */
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  /**
   * Use this to render the devtools inside a different type of container element for a11y purposes.
   * Any string which corresponds to a valid intrinsic JSX element is allowed.
   * Defaults to 'footer'.
   */
  containerElement?: string | any
  /**
   * The router instance to use for the devtools.
   */
  router?: AnyRouter
  /**
   * Use this to attach the devtool's styles to specific element in the DOM.
   */
  shadowDOMTarget?: ShadowRoot
}

export const TanStackRouterDevtools = /* #__PURE__ */ defineComponent({
  name: 'TanStackRouterDevtools',
  props: [
    'initialIsOpen',
    'panelProps',
    'closeButtonProps',
    'toggleButtonProps',
    'position',
    'containerElement',
    'router',
    'shadowDOMTarget',
  ] as unknown as undefined,
  setup(props: TanStackRouterDevtoolsOptions) {
    const devToolRef = ref<HTMLDivElement | null>(null)
    let isMounted = false

    const hookRouter = useRouter({ warn: false })
    const activeRouter = props.router ?? hookRouter

    const activeRouterState = useRouterState({ router: activeRouter })

    const devtools = new TanStackRouterDevtoolsCore({
      initialIsOpen: props.initialIsOpen,
      panelProps: props.panelProps,
      closeButtonProps: props.closeButtonProps,
      toggleButtonProps: props.toggleButtonProps,
      position: props.position,
      containerElement: props.containerElement,
      shadowDOMTarget: props.shadowDOMTarget,
      router: activeRouter,
      routerState: activeRouterState.value,
    })

    // Update devtools when router changes
    watch(
      () => activeRouter,
      (router) => {
        devtools.setRouter(router)
      },
    )

    // Update devtools when router state changes
    watch(activeRouterState, (routerState) => {
      devtools.setRouterState(routerState)
    })

    // Update devtools when options change
    watch(
      () => [
        props.initialIsOpen,
        props.panelProps,
        props.closeButtonProps,
        props.toggleButtonProps,
        props.position,
        props.containerElement,
        props.shadowDOMTarget,
      ],
      () => {
        devtools.setOptions({
          initialIsOpen: props.initialIsOpen,
          panelProps: props.panelProps,
          closeButtonProps: props.closeButtonProps,
          toggleButtonProps: props.toggleButtonProps,
          position: props.position,
          containerElement: props.containerElement,
          shadowDOMTarget: props.shadowDOMTarget,
        })
      },
    )

    onMounted(() => {
      if (devToolRef.value) {
        devtools.mount(devToolRef.value)
        isMounted = true
      }
    })

    onUnmounted(() => {
      if (isMounted) {
        devtools.unmount()
      }
    })

    return () => h('div', { ref: devToolRef })
  },
})
