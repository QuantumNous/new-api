// This file uses createCompositeComponent with a callback that renders a component
// which has client-only code (onClick handler)
import { createCompositeComponent } from '@tanstack/react-start/rsc'
import { ClientComponent } from './client-component'

export const ServerComponent = createCompositeComponent(() => {
  return (
    <div>
      <h1>Server rendered</h1>
      <ClientComponent />
    </div>
  )
})
