// Async component - should error when used in route options
export async function AsyncComponent() {
  const data = await fetch('https://example.com')
  return <div>{data.status}</div>
}
