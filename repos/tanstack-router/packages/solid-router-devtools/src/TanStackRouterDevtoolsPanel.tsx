import { useRouter, useRouterState } from '@tanstack/solid-router'
import { TanStackRouterDevtoolsPanelCore } from '@tanstack/router-devtools-core'
import { createEffect, createSignal, onCleanup, onMount } from 'solid-js'
import type { AnyRouter } from '@tanstack/solid-router'
import type { Component, JSX } from 'solid-js'

export interface TanStackRouterDevtoolsPanelOptions {
  /**
   * The standard React style object used to style a component with inline styles
   */
  style?: JSX.CSSProperties
  /**
   * The standard React class property used to style a component with classes
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
   * A boolean variable indicating if the "lite" version of the library is being used
   */
  router?: AnyRouter
  /**
   * Use this to attach the devtool's styles to specific element in the DOM.
   */
  shadowDOMTarget?: ShadowRoot
}

export const TanStackRouterDevtoolsPanel: Component<
  TanStackRouterDevtoolsPanelOptions
> = (props): JSX.Element | null => {
  const activeRouter = props.router ?? useRouter()
  const activeRouterState = useRouterState({ router: activeRouter })

  const usedProps = {
    ...props,
    router: activeRouter,
    routerState: activeRouterState,
  }

  let devToolRef: HTMLDivElement | undefined
  const [devtools] = createSignal(
    new TanStackRouterDevtoolsPanelCore(usedProps),
  )

  // Update devtools when props change
  createEffect(() => {
    devtools().setRouter(usedProps.router)
  })

  createEffect(() => {
    devtools().setRouterState(usedProps.routerState)
  })

  createEffect(() => {
    devtools().setOptions({
      className: usedProps.className,
      style: usedProps.style,
      shadowDOMTarget: usedProps.shadowDOMTarget,
    })
  })

  onMount(() => {
    if (devToolRef) {
      devtools().mount(devToolRef)

      onCleanup(() => {
        devtools().unmount()
      })
    }
  })

  return (
    <>
      <div ref={devToolRef} />
    </>
  )
}
