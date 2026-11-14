'use client'

import { TanStackRouterDevtoolsCore } from '@tanstack/router-devtools-core'
import { Fragment, useEffect, useRef, useState } from 'react'
import { useRouter, useRouterState } from '@tanstack/react-router'
import type { ButtonHTMLAttributes, HTMLAttributes } from 'react'
import type { AnyRouter } from '@tanstack/react-router'
import type React from 'react'

export interface TanStackRouterDevtoolsOptions {
  /**
   * Set this true if you want the dev tools to default to being open
   */
  initialIsOpen?: boolean
  /**
   * Use this to add props to the panel. For example, you can add className, style (merge and override default style), etc.
   */
  panelProps?: HTMLAttributes<HTMLDivElement>
  /**
   * Use this to add props to the close button. For example, you can add className, style (merge and override default style), onClick (extend default handler), etc.
   */
  closeButtonProps?: ButtonHTMLAttributes<HTMLButtonElement>
  /**
   * Use this to add props to the toggle button. For example, you can add className, style (merge and override default style), onClick (extend default handler), etc.
   */
  toggleButtonProps?: ButtonHTMLAttributes<HTMLButtonElement>
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

export function TanStackRouterDevtools(
  props: TanStackRouterDevtoolsOptions,
): React.ReactElement | null {
  const {
    initialIsOpen,
    panelProps,
    closeButtonProps,
    toggleButtonProps,
    position,
    containerElement,
    shadowDOMTarget,
    router: propsRouter,
  } = props

  const hookRouter = useRouter({ warn: false })
  const activeRouter = propsRouter ?? hookRouter

  const activeRouterState = useRouterState({ router: activeRouter })

  const devToolRef = useRef<HTMLDivElement>(null)
  const [devtools] = useState(
    () =>
      new TanStackRouterDevtoolsCore({
        initialIsOpen,
        panelProps,
        closeButtonProps,
        toggleButtonProps,
        position,
        containerElement,
        shadowDOMTarget,
        router: activeRouter,
        routerState: activeRouterState,
      }),
  )

  // Update devtools when props change
  useEffect(() => {
    devtools.setRouter(activeRouter)
  }, [devtools, activeRouter])

  useEffect(() => {
    devtools.setRouterState(activeRouterState)
  }, [devtools, activeRouterState])

  useEffect(() => {
    devtools.setOptions({
      initialIsOpen: initialIsOpen,
      panelProps: panelProps,
      closeButtonProps: closeButtonProps,
      toggleButtonProps: toggleButtonProps,
      position: position,
      containerElement: containerElement,
      shadowDOMTarget: shadowDOMTarget,
    })
  }, [
    devtools,
    initialIsOpen,
    panelProps,
    closeButtonProps,
    toggleButtonProps,
    position,
    containerElement,
    shadowDOMTarget,
  ])

  useEffect(() => {
    if (devToolRef.current) {
      devtools.mount(devToolRef.current)
    }

    return () => {
      devtools.unmount()
    }
  }, [devtools])

  return (
    <Fragment>
      <div ref={devToolRef} />
    </Fragment>
  )
}
