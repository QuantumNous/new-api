import { expect, vi } from 'vitest';
import * as React from 'react';
import { createRenderer, MuiRenderResult, screen } from '@mui/internal-test-utils';
import { getReactElementRef } from './getReactElementRef';
import { useMergedRefs } from './useMergedRefs';

describe('useMergedRefs', () => {
  const { render } = createRenderer();

  it('returns a single ref-setter function that forks the ref to its inputs', () => {
    interface TestComponentProps {
      innerRef: React.Ref<HTMLDivElement | null>;
    }

    function Component(props: TestComponentProps) {
      const { innerRef } = props;
      const [ownRefCurrent, ownRef] = React.useState<HTMLDivElement | null>(null);

      const handleRef = useMergedRefs(innerRef, ownRef);

      return <div ref={handleRef}>{ownRefCurrent ? 'has a ref' : 'has no ref'}</div>;
    }

    const outerRef = React.createRef<HTMLDivElement>();

    expect(() => {
      render(<Component innerRef={outerRef} />);
    }).not.toErrorDev();
    expect(outerRef.current!.textContent).toBe('has a ref');
  });

  it('forks if only one of the branches requires a ref', () => {
    const Component = React.forwardRef(function Component(props, ref) {
      const [hasRef, setHasRef] = React.useState(false);
      const handleOwnRef = React.useCallback(() => setHasRef(true), []);
      const handleRef = useMergedRefs(handleOwnRef, ref);

      return (
        <div ref={handleRef} data-testid="hasRef">
          {String(hasRef)}
        </div>
      );
    });

    expect(() => {
      render(<Component />);
    }).not.toErrorDev();

    expect(screen.getByTestId('hasRef')).toHaveTextContent('true');
  });

  it('does nothing if none of the forked branches requires a ref', () => {
    interface TestComponentProps {
      children: React.ReactElement<any>;
    }

    const Outer = React.forwardRef<HTMLDivElement, TestComponentProps>(function Outer(props, ref) {
      const { children } = props;
      const handleRef = useMergedRefs(getReactElementRef(children), ref);

      return React.cloneElement(children, { ref: handleRef });
    });

    function Inner() {
      return <div />;
    }

    expect(() => {
      render(
        <Outer>
          <Inner />
        </Outer>,
      );
    }).not.toErrorDev();
  });

  describe('changing refs', () => {
    interface TestComponentProps {
      leftRef?: React.Ref<HTMLDivElement | null>;
      rightRef?: React.Ref<HTMLDivElement | null>;
      id?: string;
    }

    function Div(props: TestComponentProps) {
      const { leftRef, rightRef, ...other } = props;
      const handleRef = useMergedRefs(leftRef, rightRef);

      return <div {...other} ref={handleRef} />;
    }

    it('handles changing from no ref to some ref', () => {
      let view: MuiRenderResult;

      expect(() => {
        view = render(<Div id="test" />);
      }).not.toErrorDev();

      const ref = React.createRef<HTMLDivElement>();
      expect(() => {
        view.setProps({ leftRef: ref });
      }).not.toErrorDev();
      expect(ref.current!.id).toBe('test');
    });

    it('cleans up detached refs', () => {
      const firstLeftRef = React.createRef<HTMLDivElement>();
      const firstRightRef = React.createRef<HTMLDivElement>();
      const secondRightRef = React.createRef<HTMLDivElement>();
      let view: MuiRenderResult;

      expect(() => {
        view = render(<Div leftRef={firstLeftRef} rightRef={firstRightRef} id="test" />);
      }).not.toErrorDev();

      expect(firstLeftRef.current!.id).toBe('test');
      expect(firstRightRef.current!.id).toBe('test');
      expect(secondRightRef.current).toBe(null);

      view!.setProps({ rightRef: secondRightRef });

      expect(firstLeftRef.current!.id).toBe('test');
      expect(firstRightRef.current).toBe(null);
      expect(secondRightRef.current!.id).toBe('test');
    });
  });

  test('calls clean up function if it exists', () => {
    const cleanUp = vi.fn();
    const setup = vi.fn();
    const setup2 = vi.fn();
    const nullHandler = vi.fn();

    function onRefChangeWithCleanup(ref: HTMLDivElement | null) {
      if (ref) {
        setup(ref.id);
      } else {
        nullHandler();
      }
      return cleanUp;
    }

    function onRefChangeWithoutCleanup(ref: HTMLDivElement | null) {
      if (ref) {
        setup2(ref.id);
      } else {
        nullHandler();
      }
    }

    function App() {
      const ref = useMergedRefs(onRefChangeWithCleanup, onRefChangeWithoutCleanup);
      return <div id="test" ref={ref} />;
    }

    const { unmount } = render(<App />, { strict: false });

    expect(setup.mock.calls[0][0]).toBe('test');
    expect(setup.mock.calls.length).toBe(1);
    expect(cleanUp.mock.calls.length).toBe(0);

    expect(setup2.mock.calls[0][0]).toBe('test');
    expect(setup2.mock.calls.length).toBe(1);

    unmount();

    expect(setup.mock.calls.length).toBe(1);
    expect(cleanUp.mock.calls.length).toBe(1);

    // Setup was not called again
    expect(setup2.mock.calls.length).toBe(1);
    // Null handler hit because no cleanup is returned
    expect(nullHandler.mock.calls.length).toBe(1);
  });
});
