import { expect } from 'vitest';
import * as React from 'react';
import {
  DirectionProvider,
  useDirection,
  type TextDirection,
} from '@base-ui/react/direction-provider';
import { screen } from '@mui/internal-test-utils';
import { createRenderer } from '#test-utils';

function DirectionProbe() {
  const direction = useDirection();
  return <span data-testid="direction">{direction}</span>;
}

function DirectionProviderTest(props: { direction?: TextDirection }) {
  return (
    <DirectionProvider direction={props.direction}>
      <DirectionProbe />
    </DirectionProvider>
  );
}

describe('<DirectionProvider />', () => {
  const { render } = createRenderer();

  it('defaults useDirection to ltr outside a provider', async () => {
    await render(<DirectionProbe />);

    expect(screen.getByTestId('direction')).toHaveTextContent('ltr');
  });

  it('provides the configured direction to descendants', async () => {
    const { setProps } = await render(<DirectionProviderTest direction="rtl" />);

    expect(screen.getByTestId('direction')).toHaveTextContent('rtl');

    await setProps({ direction: 'ltr' });

    expect(screen.getByTestId('direction')).toHaveTextContent('ltr');
  });
});
