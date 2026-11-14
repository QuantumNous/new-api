import { createSignal, lazy } from 'solid-js'
import { render } from 'solid-js/web'
import { ShadowDomTargetContext } from './context'
import type { AnyRouter } from '@tanstack/router-core'
import type { Signal } from 'solid-js'

export interface TanStackRouterDevtoolsCoreOptions {
  /**
   * Set this true if you want the dev tools to default to being open
   */
  initialIsOpen?: boolean
  /**
   * Use this to add props to the panel. For example, you can add class, style (merge and override default style), etc.
   */
  panelProps?: any & {
    ref?: any
  }
  /**
   * Use this to add props to the close button. For example, you can add class, style (merge and override default style), onClick (extend default handler), etc.
   */
  closeButtonProps?: any & {
    ref?: any
  }
  /**
   * Use this to add props to the toggle button. For example, you can add class, style (merge and override default style), onClick (extend default handler), etc.
   */
  toggleButtonProps?: any & {
    ref?: any
  }
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
   * A boolean variable indicating if the "lite" version of the library is being used
   */
  router: AnyRouter
  routerState: any
  /**
   * Use this to attach the devtool's styles to specific element in the DOM.
   */
  shadowDOMTarget?: ShadowRoot
}

export class TanStackRouterDevtoolsCore {
  #router: Signal<AnyRouter>
  #routerState: Signal<any>
  #position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  #initialIsOpen: boolean
  #shadowDOMTarget?: ShadowRoot

  #panelProps: any
  #closeButtonProps: any
  #toggleButtonProps: any
  #containerElement?: string | any

  #isMounted = false
  #Component: any
  #dispose?: () => void

  constructor(config: TanStackRouterDevtoolsCoreOptions) {
    this.#router = createSignal(config.router)
    this.#routerState = createSignal(config.routerState)
    this.#position = config.position ?? 'bottom-left'
    this.#initialIsOpen = config.initialIsOpen ?? false
    this.#shadowDOMTarget = config.shadowDOMTarget

    this.#panelProps = config.panelProps
    this.#closeButtonProps = config.closeButtonProps
    this.#toggleButtonProps = config.toggleButtonProps
    this.#containerElement = config.containerElement
  }

  mount<T extends HTMLElement>(el: T) {
    if (this.#isMounted) {
      throw new Error('Devtools is already mounted')
    }

    const dispose = render(() => {
      const [router] = this.#router
      const [routerState] = this.#routerState
      const position = this.#position
      const initialIsOpen = this.#initialIsOpen
      const shadowDOMTarget = this.#shadowDOMTarget

      const panelProps = this.#panelProps
      const closeButtonProps = this.#closeButtonProps
      const toggleButtonProps = this.#toggleButtonProps
      const containerElement = this.#containerElement

      let Devtools

      if (this.#Component) {
        Devtools = this.#Component
      } else {
        Devtools = lazy(() => import('./FloatingTanStackRouterDevtools'))
        this.#Component = Devtools
      }

      return (
        <ShadowDomTargetContext.Provider value={shadowDOMTarget}>
          <Devtools
            position={position}
            initialIsOpen={initialIsOpen}
            router={router}
            routerState={routerState}
            shadowDOMTarget={shadowDOMTarget}
            panelProps={panelProps}
            closeButtonProps={closeButtonProps}
            toggleButtonProps={toggleButtonProps}
            containerElement={containerElement}
          />
        </ShadowDomTargetContext.Provider>
      )
    }, el)

    this.#isMounted = true
    this.#dispose = dispose
  }

  unmount() {
    if (!this.#isMounted) {
      throw new Error('Devtools is not mounted')
    }
    this.#dispose?.()
    this.#isMounted = false
  }

  setRouter(router: AnyRouter) {
    this.#router[1](router)
  }

  setRouterState(routerState: any) {
    this.#routerState[1](routerState)
  }

  setOptions(options: Partial<TanStackRouterDevtoolsCoreOptions>) {
    if (options.position !== undefined) {
      this.#position = options.position
    }

    if (options.initialIsOpen !== undefined) {
      this.#initialIsOpen = options.initialIsOpen
    }

    if (options.shadowDOMTarget !== undefined) {
      this.#shadowDOMTarget = options.shadowDOMTarget
    }

    if (options.containerElement !== undefined) {
      this.#containerElement = options.containerElement
    }
  }
}
