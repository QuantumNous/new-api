import { Hydrate } from '@tanstack/react-start';
import { idle, visible } from '@tanstack/react-start/hydration';
const spreadProps = {
  when: visible()
};
function Widget(props: {
  title: string;
}) {
  return <p>{props.title}</p>;
}
export function Page() {
  return <>
      <Hydrate when={visible()} h="0_7f4dc3aa80">
        <Widget title="direct" />
      </Hydrate>
      <Hydrate {...{
      when: idle()
    }} h="1_7f4dc3aa80">
        <Widget title="inline spread" />
      </Hydrate>
      <Hydrate {...spreadProps} h="2_7f4dc3aa80">
        <Widget title="bound spread" />
      </Hydrate>
    </>;
}