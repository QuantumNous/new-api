import { render } from 'solid-js/web'
import { createSignal, lazy } from 'solid-js'
import { DevtoolsOnCloseContext, ShadowDomTargetContext } from './context'
import type { JSX } from 'solid-js'
import type { AnyRouter } from '@tanstack/router-core'

export interface TanStackRouterDevtoolsPanelCoreOptions {
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
  router: AnyRouter

  routerState: any
  /**
   * Use this to attach the devtool's styles to specific element in the DOM.
   */
  shadowDOMTarget?: ShadowRoot
}

export class TanStackRouterDevtoolsPanelCore {
  #router: any
  #routerState: any
  #style: any
  #className: any
  #shadowDOMTarget?: ShadowRoot
  #isMounted = false
  #setIsOpen?: (isOpen: boolean) => void
  #dispose?: () => void
  #Component: any

  constructor(config: TanStackRouterDevtoolsPanelCoreOptions) {
    const {
      router,
      routerState,
      shadowDOMTarget,
      setIsOpen,
      style,
      className,
    } = config

    this.#router = createSignal(router)
    this.#routerState = createSignal(routerState)
    this.#style = createSignal(style)
    this.#className = createSignal(className)
    this.#shadowDOMTarget = shadowDOMTarget
    this.#setIsOpen = setIsOpen
  }

  mount<T extends HTMLElement>(el: T) {
    if (this.#isMounted) {
      throw new Error('Devtools is already mounted')
    }

    const dispose = render(() => {
      const [router] = this.#router
      const [routerState] = this.#routerState
      const [style] = this.#style
      const [className] = this.#className
      const shadowDOMTarget = this.#shadowDOMTarget
      const setIsOpen = this.#setIsOpen

      let BaseTanStackRouterDevtoolsPanel

      if (this.#Component) {
        BaseTanStackRouterDevtoolsPanel = this.#Component
      } else {
        BaseTanStackRouterDevtoolsPanel = lazy(
          () => import('./BaseTanStackRouterDevtoolsPanel'),
        )
        this.#Component = BaseTanStackRouterDevtoolsPanel
      }

      return (
        <ShadowDomTargetContext.Provider value={shadowDOMTarget}>
          <DevtoolsOnCloseContext.Provider
            value={{
              onCloseClick: () => {},
            }}
          >
            <BaseTanStackRouterDevtoolsPanel
              router={router}
              routerState={routerState}
              shadowDOMTarget={shadowDOMTarget}
              setIsOpen={setIsOpen}
              style={style}
              className={className}
            />
          </DevtoolsOnCloseContext.Provider>
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

  setStyle(style: any) {
    this.#style[1](style)
  }

  setClassName(className: any) {
    this.#className[1](className)
  }

  setOptions(options: Partial<TanStackRouterDevtoolsPanelCoreOptions>) {
    if (options.shadowDOMTarget !== undefined) {
      this.#shadowDOMTarget = options.shadowDOMTarget
    }
    if (options.router !== undefined) {
      this.setRouter(options.router)
    }
    if (options.routerState !== undefined) {
      this.setRouterState(options.routerState)
    }

    if (options.style !== undefined) {
      this.setStyle(options.style)
    }

    if (options.className !== undefined) {
      this.setClassName(options.className)
    }
  }
}
