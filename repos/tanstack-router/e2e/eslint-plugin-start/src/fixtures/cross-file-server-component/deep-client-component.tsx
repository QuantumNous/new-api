// Deep nested component with client-only code
import { useState } from 'react'

export function DeepClientComponent() {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount((c) => c + 1)}>Count: {count}</button>
}
