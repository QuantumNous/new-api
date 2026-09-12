// Component passed directly to createCompositeComponent
// Contains onClick handler which is not allowed in server components
export function DirectClientComponent() {
  return (
    <div>
      <span>Direct component</span>
      <button onClick={() => alert('hello')}>Click</button>
    </div>
  )
}
