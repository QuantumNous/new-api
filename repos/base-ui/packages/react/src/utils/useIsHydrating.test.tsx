import { expect } from 'vitest';
import * as React from 'react';
import { screen, waitFor } from '@mui/internal-test-utils';
import { createRenderer } from '#test-utils';
import { useIsHydrating } from './useIsHydrating';

describe('useIsHydrating', () => {
  const { render, renderToString } = createRenderer();

  function TestComponent() {
    const isHydrating = useIsHydrating();

    return <span data-testid="value">{String(isHydrating)}</span>;
  }

  it('returns false for client-only mounts', async () => {
    await render(<TestComponent />);

    expect(screen.getByTestId('value')).toHaveTextContent('false');
  });

  it('returns true before hydration for server-rendered markup', async () => {
    await renderToString(<TestComponent />);

    expect(screen.getByTestId('value')).toHaveTextContent('true');
  });

  it('switches to false after hydration completes', async () => {
    const { hydrate } = await renderToString(<TestComponent />);

    expect(screen.getByTestId('value')).toHaveTextContent('true');

    hydrate();

    await waitFor(() => {
      expect(screen.getByTestId('value')).toHaveTextContent('false');
    });
  });
});
