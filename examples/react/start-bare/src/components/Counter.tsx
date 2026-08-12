import { useState } from 'react'
import './Counter.css'

export default function Counter() {
  const [count, setCount] = useState(0)
  return (
    <button
      className="increment"
      onClick={() => setCount(count + 1)}
      type="button"
    >
      Clicks: {count}
    </button>
  )
}
