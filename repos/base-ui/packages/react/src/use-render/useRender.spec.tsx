/* eslint-disable react-hooks/rules-of-hooks */
import * as React from 'react';
import { expectType } from '#test-utils';
import { useRender } from './useRender';
import { Button } from '../button';

const element1 = useRender({
  render: () => <div>Test</div>,
});

expectType<React.ReactElement, typeof element1>(element1);

const element2 = useRender({
  render: () => <div>Test</div>,
  enabled: true,
});

expectType<React.ReactElement, typeof element2>(element2);

const element3 = useRender({
  render: () => <div>Test</div>,
  enabled: false,
});

expectType<null, typeof element3>(element3);

const element4 = useRender({
  render: () => <div>Test</div>,
  enabled: Math.random() > 0.5,
});

expectType<React.ReactElement | null, typeof element4>(element4);

const element5 = useRender({
  render: () => <button type="button">Click</button>,
});

expectType<React.ReactElement, typeof element5>(element5);

const element6 = useRender({
  render: <div />,
});

expectType<React.ReactElement, typeof element6>(element6);

const element7 = useRender({
  render: <button type="button" aria-label="Submit" />,
  props: {
    className: 'btn-primary',
    onClick: () => console.log('clicked'),
  },
});

expectType<React.ReactElement, typeof element7>(element7);

function App() {
  const element = useRender({ defaultTagName: 'div' });
  return <Button render={element} />;
}
