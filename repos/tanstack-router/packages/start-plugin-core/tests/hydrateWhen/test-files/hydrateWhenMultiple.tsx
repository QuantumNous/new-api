import { Hydrate } from '@tanstack/react-start'
import { load, media, visible } from '@tanstack/react-start/hydration'

function Summary() {
  return <section>Summary</section>
}

function Comments() {
  return <section>Comments</section>
}

function Footer() {
  return <footer>Footer</footer>
}

export function Page() {
  return (
    <>
      <Hydrate when={load()}>
        <Summary />
      </Hydrate>
      <Hydrate when={visible()}>
        <Comments />
      </Hydrate>
      <Hydrate when={media('(min-width: 800px)')}>
        <Footer />
      </Hydrate>
    </>
  )
}
