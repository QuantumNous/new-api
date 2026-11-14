import { expect } from 'vitest';
import * as React from 'react';
import { createRenderer, screen } from '@mui/internal-test-utils';
import { useId } from '@base-ui/utils/useId';

interface TestComponentProps {
  id?: string;
}

describe('useId', () => {
  const { render, renderToString } = createRenderer();

  it('returns the provided ID', () => {
    function TestComponent({ id: idProp }: TestComponentProps) {
      const id = useId(idProp);
      return <span data-testid="target" id={id} />;
    }
    const { hydrate } = renderToString(<TestComponent id="some-id" />);
    const { setProps } = hydrate();

    expect(screen.getByTestId('target')).toHaveProperty('id', 'some-id');

    setProps({ id: 'another-id' });

    expect(screen.getByTestId('target')).toHaveProperty('id', 'another-id');
  });

  it("generates an ID if one isn't provided", () => {
    function TestComponent({ id: idProp }: TestComponentProps) {
      const id = useId(idProp);
      return <span data-testid="target" id={id} />;
    }
    const { hydrate } = renderToString(<TestComponent />);
    const { setProps } = hydrate();

    expect(screen.getByTestId('target').id).not.toBe('');

    setProps({ id: 'another-id' });
    expect(screen.getByTestId('target')).toHaveProperty('id', 'another-id');
  });

  it('can be suffixed', () => {
    function Widget() {
      const id = useId();
      const labelId = `${id}-label`;

      return (
        <React.Fragment>
          <span data-testid="labelable" aria-labelledby={labelId} />
          <span data-testid="label" id={labelId}>
            Label
          </span>
        </React.Fragment>
      );
    }
    render(<Widget />);

    expect(screen.getByTestId('labelable')).toHaveAttribute(
      'aria-labelledby',
      screen.getByTestId('label').id,
    );
  });

  it('can be used in in IDREF attributes', () => {
    function Widget() {
      const labelPartA = useId();
      const labelPartB = useId();

      return (
        <React.Fragment>
          <span data-testid="labelable" aria-labelledby={`${labelPartA} ${labelPartB}`} />
          <span data-testid="labelA" id={labelPartA}>
            A
          </span>
          <span data-testid="labelB" id={labelPartB}>
            B
          </span>
        </React.Fragment>
      );
    }
    render(<Widget />);

    expect(screen.getByTestId('labelable')).toHaveAttribute(
      'aria-labelledby',
      `${screen.getByTestId('labelA').id} ${screen.getByTestId('labelB').id}`,
    );
  });

  it('provides an ID on server in React 18', ({ skip }) => {
    if (React.useId === undefined) {
      skip();
    }
    function TestComponent() {
      const id = useId();
      return <span data-testid="target" id={id} />;
    }
    renderToString(<TestComponent />);

    expect(screen.getByTestId('target').id).not.toBe('');
  });

  it('can be prefixed', () => {
    const PREFIX = 'base-ui';
    function Widget() {
      const id = useId(undefined, PREFIX);

      return (
        <React.Fragment>
          <span data-testid="labelable" aria-labelledby={id} />
          <span data-testid="label" id={id}>
            Label
          </span>
        </React.Fragment>
      );
    }
    render(<Widget />);

    expect(screen.getByTestId('label').id.slice(0, 8)).toBe(`${PREFIX}-`);
    expect(screen.getByTestId('labelable')).toHaveAttribute(
      'aria-labelledby',
      screen.getByTestId('label').id,
    );
  });
});
