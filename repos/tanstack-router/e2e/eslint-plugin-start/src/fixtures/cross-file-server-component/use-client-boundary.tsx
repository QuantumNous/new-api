// Valid: Client component is in a 'use client' file - should NOT error
'use client'

import { useState } from 'react'

export function UseClientComponent() {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount((c) => c + 1)}>Count: {count}</button>
}
