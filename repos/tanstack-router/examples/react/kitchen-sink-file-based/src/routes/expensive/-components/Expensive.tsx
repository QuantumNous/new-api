import * as React from 'react'

export default function Expensive() {
  return (
    <div className={`p-2`}>
      I am an "expensive" component... which really just means that I was
      code-split 😉
    </div>
  )
}
