import { Hydrate } from '@tanstack/react-start';
import { load, media, visible } from '@tanstack/react-start/hydration';
function Summary() {
  return <section>Summary</section>;
}
function Comments() {
  return <section>Comments</section>;
}
function Footer() {
  return <footer>Footer</footer>;
}
export function Page() {
  return <>
      <Hydrate when={load()} h="0_21aa371e0f">
        <Summary />
      </Hydrate>
      <Hydrate when={visible()} h="1_21aa371e0f">
        <Comments />
      </Hydrate>
      <Hydrate when={media('(min-width: 800px)')} h="2_21aa371e0f">
        <Footer />
      </Hydrate>
    </>;
}