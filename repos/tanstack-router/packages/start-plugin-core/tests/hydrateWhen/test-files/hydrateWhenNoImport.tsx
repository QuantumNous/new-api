export function Page() {
  return (
    <Hydrate when={visible()}>
      <p>No transform</p>
    </Hydrate>
  )
}
