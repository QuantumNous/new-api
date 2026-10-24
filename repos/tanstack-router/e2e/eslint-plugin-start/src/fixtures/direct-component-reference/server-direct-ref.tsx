// This file uses createCompositeComponent with a direct component reference
// Pattern: createCompositeComponent(MyComponent)
import { createCompositeComponent } from '@tanstack/react-start/rsc'
import { DirectClientComponent } from './direct-client-component'

export const ServerComponent = createCompositeComponent(DirectClientComponent)
