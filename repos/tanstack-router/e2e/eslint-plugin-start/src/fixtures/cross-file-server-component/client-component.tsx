// Client component with onClick handler - should error when used in server component
export function ClientComponent() {
  return <button onClick={() => console.log('clicked')}>Click me</button>
}
