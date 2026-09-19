// Middle component that renders the actual client component
import { DeepClientComponent } from './deep-client-component'

export function MiddleComponent() {
  return (
    <div>
      <span>Middle layer</span>
      <DeepClientComponent />
    </div>
  )
}
