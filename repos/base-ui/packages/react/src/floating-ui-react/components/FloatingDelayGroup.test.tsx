import { vi, expect } from 'vitest';

/* eslint-disable react/jsx-fragments */
import * as React from 'react';
import { act, fireEvent, render, screen } from '@mui/internal-test-utils';

import { isJSDOM, useTestInteractions } from '#test-utils';
import { FloatingDelayGroup, useDelayGroup, useFloating, useHover } from '../index';

interface Props {
  label: string;
  children: React.JSX.Element;
}

function Tooltip({ children, label }: Props) {
  const [open, setOpen] = React.useState(false);

  const { x, y, refs, strategy, context } = useFloating({
    open,
    onOpenChange: setOpen,
  });

  const { delayRef } = useDelayGroup(context, { open });
  const hover = useHover(context, { delay: () => delayRef.current });
  const { getReferenceProps } = useTestInteractions([hover]);

  const renderCount = React.useRef(0);
  const renderCountRef = React.useRef<HTMLSpanElement | null>(null);

  React.useEffect(() => {
    renderCount.current += 1;
    if (renderCountRef.current) {
      renderCountRef.current.textContent = String(renderCount.current);
    }
  });

  return (
    <>
      {React.cloneElement(
        children,
        getReferenceProps({
          ref: refs.setReference,
          ...children.props,
        }),
      )}
      <span data-testid={`render-count-${label}`} ref={renderCountRef} />
      {open && (
        <div
          data-testid={`floating-${label}`}
          ref={refs.setFloating}
          style={{
            position: strategy,
            top: y ?? '',
            left: x ?? '',
          }}
        >
          {label}
        </div>
      )}
    </>
  );
}

function App() {
  return (
    <FloatingDelayGroup delay={{ open: 1000, close: 200 }}>
      <Tooltip label="one">
        <button data-testid="reference-one" />
      </Tooltip>
      <Tooltip label="two">
        <button data-testid="reference-two" />
      </Tooltip>
      <Tooltip label="three">
        <button data-testid="reference-three" />
      </Tooltip>
    </FloatingDelayGroup>
  );
}

describe.skipIf(!isJSDOM)('FloatingDelayGroup', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  test('groups delays correctly', async () => {
    render(<App />);

    fireEvent.mouseEnter(screen.getByTestId('reference-one'));

    await act(async () => {
      vi.advanceTimersByTime(1);
    });

    expect(screen.queryByTestId('floating-one')).not.toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(999);
    });

    expect(screen.getByTestId('floating-one')).toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByTestId('reference-two'));

    await act(async () => {
      vi.advanceTimersByTime(1);
    });

    expect(screen.queryByTestId('floating-one')).not.toBeInTheDocument();
    expect(screen.getByTestId('floating-two')).toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByTestId('reference-three'));

    await act(async () => {
      vi.advanceTimersByTime(1);
    });

    expect(screen.queryByTestId('floating-two')).not.toBeInTheDocument();
    expect(screen.getByTestId('floating-three')).toBeInTheDocument();

    fireEvent.mouseLeave(screen.getByTestId('reference-three'));

    await act(async () => {
      vi.advanceTimersByTime(1);
    });

    expect(screen.getByTestId('floating-three')).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(199);
    });

    expect(screen.queryByTestId('floating-three')).not.toBeInTheDocument();
  });

  test('timeoutMs', async () => {
    function App() {
      return (
        <FloatingDelayGroup delay={{ open: 1000, close: 100 }} timeoutMs={500}>
          <Tooltip label="one">
            <button data-testid="reference-one" />
          </Tooltip>
          <Tooltip label="two">
            <button data-testid="reference-two" />
          </Tooltip>
          <Tooltip label="three">
            <button data-testid="reference-three" />
          </Tooltip>
        </FloatingDelayGroup>
      );
    }

    render(<App />);

    fireEvent.mouseEnter(screen.getByTestId('reference-one'));

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    fireEvent.mouseLeave(screen.getByTestId('reference-one'));

    expect(screen.getByTestId('floating-one')).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(499);
    });

    expect(screen.queryByTestId('floating-one')).not.toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByTestId('reference-two'));

    await act(async () => {
      vi.advanceTimersByTime(1);
    });

    expect(screen.getByTestId('floating-two')).toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByTestId('reference-three'));

    await act(async () => {
      vi.advanceTimersByTime(1);
    });

    expect(screen.queryByTestId('floating-two')).not.toBeInTheDocument();
    expect(screen.getByTestId('floating-three')).toBeInTheDocument();

    fireEvent.mouseLeave(screen.getByTestId('reference-three'));

    await act(async () => {
      vi.advanceTimersByTime(1);
    });

    expect(screen.getByTestId('floating-three')).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(99);
    });

    expect(screen.queryByTestId('floating-three')).not.toBeInTheDocument();
  });

  it('keeps the active context when an inactive consumer unmounts', async () => {
    function Test() {
      const [showSecond, setShowSecond] = React.useState(true);

      return (
        <FloatingDelayGroup delay={{ open: 1000, close: 100 }} timeoutMs={500}>
          <Tooltip label="one">
            <button data-testid="reference-one" />
          </Tooltip>
          {showSecond && (
            <Tooltip label="two">
              <button data-testid="reference-two" />
            </Tooltip>
          )}
          <Tooltip label="three">
            <button data-testid="reference-three" />
          </Tooltip>
          <button type="button" onClick={() => setShowSecond(false)}>
            Remove inactive
          </button>
        </FloatingDelayGroup>
      );
    }

    render(<Test />);

    fireEvent.mouseEnter(screen.getByTestId('reference-one'));

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByTestId('floating-one')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Remove inactive' }));
    expect(screen.queryByTestId('reference-two')).not.toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByTestId('reference-three'));

    await act(async () => {
      vi.advanceTimersByTime(1);
    });

    expect(screen.queryByTestId('floating-one')).not.toBeInTheDocument();
    expect(screen.getByTestId('floating-three')).toBeInTheDocument();
  });

  it('keeps the timeout active when the last closed consumer unmounts', async () => {
    function Test() {
      const [showFirst, setShowFirst] = React.useState(true);

      return (
        <FloatingDelayGroup delay={{ open: 1000, close: 100 }} timeoutMs={500}>
          {showFirst && (
            <Tooltip label="one">
              <button data-testid="reference-one" />
            </Tooltip>
          )}
          <Tooltip label="two">
            <button data-testid="reference-two" />
          </Tooltip>
          <button type="button" onClick={() => setShowFirst(false)}>
            Remove closed
          </button>
        </FloatingDelayGroup>
      );
    }

    render(<Test />);

    fireEvent.mouseEnter(screen.getByTestId('reference-one'));

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    fireEvent.mouseLeave(screen.getByTestId('reference-one'));

    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    expect(screen.queryByTestId('floating-one')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Remove closed' }));
    expect(screen.queryByTestId('reference-one')).not.toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByTestId('reference-two'));

    await act(async () => {
      vi.advanceTimersByTime(1);
    });

    expect(screen.getByTestId('floating-two')).toBeInTheDocument();
  });

  it('does not re-render unrelated consumers', async () => {
    function App() {
      return (
        <FloatingDelayGroup delay={{ open: 1000, close: 100 }} timeoutMs={500}>
          <Tooltip label="one">
            <button data-testid="reference-one" />
          </Tooltip>
          <Tooltip label="two">
            <button data-testid="reference-two" />
          </Tooltip>
          <Tooltip label="three">
            <button data-testid="reference-three" />
          </Tooltip>
        </FloatingDelayGroup>
      );
    }

    render(<App />);

    fireEvent.mouseEnter(screen.getByTestId('reference-one'));

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    fireEvent.mouseLeave(screen.getByTestId('reference-one'));

    expect(screen.getByTestId('floating-one')).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(499);
    });

    expect(screen.queryByTestId('floating-one')).not.toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByTestId('reference-two'));

    await act(async () => {
      vi.advanceTimersByTime(1);
    });

    expect(screen.getByTestId('floating-two')).toBeInTheDocument();
    expect(screen.queryByTestId('render-count-one')).toHaveTextContent('11');
    expect(screen.queryByTestId('render-count-two')).toHaveTextContent('7');
    expect(screen.queryByTestId('render-count-three')).toHaveTextContent('3');
  });
});
