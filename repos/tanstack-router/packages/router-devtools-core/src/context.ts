import { createContext, useContext } from 'solid-js'

export const ShadowDomTargetContext = createContext<ShadowRoot | undefined>(
  undefined,
)

export const DevtoolsOnCloseContext = createContext<
  | {
      onCloseClick: (
        e: MouseEvent & { currentTarget: HTMLButtonElement; target: Element },
      ) => void
    }
  | undefined
>(undefined)

export const useDevtoolsOnClose = () => {
  const context = useContext(DevtoolsOnCloseContext)
  if (!context) {
    throw new Error(
      'useDevtoolsOnClose must be used within a TanStackRouterDevtools component',
    )
  }
  return context
}
