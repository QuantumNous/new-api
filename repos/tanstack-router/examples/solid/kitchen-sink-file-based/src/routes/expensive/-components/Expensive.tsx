import * as Solid from 'solid-js'

export default function Expensive() {
  return (
    <div class={`p-2`}>
      I am an "expensive" component... which really just means that I was
      code-split 😉
    </div>
  )
}
