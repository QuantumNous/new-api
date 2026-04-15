import { createContext, useContext, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

const PageFooterContext = createContext<HTMLDivElement | null>(null)

type PageFooterProviderProps = {
  container: HTMLDivElement | null
  children: ReactNode
}

export function PageFooterProvider(props: PageFooterProviderProps) {
  return (
    <PageFooterContext.Provider value={props.container}>
      {props.children}
    </PageFooterContext.Provider>
  )
}

export function PageFooterPortal(props: { children: ReactNode }) {
  const container = useContext(PageFooterContext)
  if (!container) return null
  return createPortal(props.children, container)
}
