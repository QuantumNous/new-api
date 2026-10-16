import { TanStackRouterDevtoolsPanelCore } from '@tanstack/router-devtools-core'
import { defineComponent, h, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter, useRouterState } from '@tanstack/vue-router'
import type { AnyRouter } from '@tanstack/vue-router'

export interface TanStackRouterDevtoolsPanelOptions {
  /**
   * The standard style object used to style a component with inline styles
   */
  style?: any
  /**
   * The standard class property used to style a component with classes
   */
  className?: string
  /**
   * A boolean variable indicating whether the panel is open or closed
   */
  isOpen?: boolean
  /**
   * A function that toggles the open and close state of the panel
   */
  setIsOpen?: (isOpen: boolean) => void
  /**
   * Handles the opening and closing the devtools panel
   */
  handleDragStart?: (e: any) => void
  /**
   * The router instance to use for the devtools.
   */
  router?: AnyRouter
  /**
   * Use this to attach the devtool's styles to specific element in the DOM.
   */
  shadowDOMTarget?: ShadowRoot
}

export const TanStackRouterDevtoolsPanel = /* #__PURE__ */ defineComponent({
  name: 'TanStackRouterDevtoolsPanel',
  props: [
    'style',
    'className',
    'isOpen',
    'setIsOpen',
    'handleDragStart',
    'router',
    'shadowDOMTarget',
  ] as unknown as undefined,
  setup(props: TanStackRouterDevtoolsPanelOptions) {
    const devToolRef = ref<HTMLDivElement | null>(null)
    let isMounted = false

    const hookRouter = useRouter({ warn: false })
    const activeRouter = props.router ?? hookRouter

    const activeRouterState = useRouterState({ router: activeRouter })

    const devtools = new TanStackRouterDevtoolsPanelCore({
      style: props.style,
      className: props.className,
      isOpen: props.isOpen,
      setIsOpen: props.setIsOpen,
      handleDragStart: props.handleDragStart,
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
      () => [props.className, props.style, props.shadowDOMTarget],
      () => {
        devtools.setOptions({
          className: props.className,
          style: props.style,
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
