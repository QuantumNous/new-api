import { expect, vi } from 'vitest';
import * as React from 'react';
import * as ReactDOMClient from 'react-dom/client';
import { waitFor } from '@mui/internal-test-utils';
import { Combobox } from '@base-ui/react/combobox';
import { createRenderer, describeConformance, isJSDOM } from '#test-utils';

describe('<Combobox.Positioner />', () => {
  const { render } = createRenderer();

  it('should not lock body scroll when controlled value={[]} triggers a re-render', async () => {
    // Render outside of act() to match real browser behavior where
    // the initial render and the useEffect re-render are separate commits.
    // Using act() batches them, hiding the bug.
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const container = document.createElement('div');
    document.body.appendChild(container);
    document.body.removeAttribute('style');
    document.documentElement.removeAttribute('style');

    function Test() {
      const [, forceRender] = React.useState(0);
      React.useEffect(() => {
        forceRender(1);
      }, []);

      return (
        <Combobox.Root multiple value={[]}>
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner />
          </Combobox.Portal>
        </Combobox.Root>
      );
    }

    const root = ReactDOMClient.createRoot(container);
    root.render(<Test />);

    // Wait for mount + useEffect re-render + setTimeout(0) in ScrollLocker.acquire
    await new Promise((resolve) => {
      setTimeout(resolve, 500);
    });

    // Bug: the re-render causes forceMount, mounting the Positioner.
    // The Positioner's `open` is `undefined` (not `false`), so
    // `open && modal` evaluates to `undefined`, which triggers
    // useScrollLock's default parameter `enabled = true`.
    const bodyOverflowX = document.body.style.overflowX;
    const bodyOverflowY = document.body.style.overflowY;
    const htmlOverflowX = document.documentElement.style.overflowX;
    const htmlOverflowY = document.documentElement.style.overflowY;

    root.unmount();
    container.remove();
    document.body.removeAttribute('style');
    document.documentElement.removeAttribute('style');
    consoleSpy.mockRestore();

    expect(bodyOverflowX).not.toBe('hidden');
    expect(bodyOverflowY).not.toBe('hidden');
    expect(htmlOverflowX).not.toBe('hidden');
    expect(htmlOverflowY).not.toBe('hidden');
  });

  describeConformance(<Combobox.Positioner />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(
        <Combobox.Root open>
          <Combobox.Portal>{node}</Combobox.Portal>
        </Combobox.Root>,
      );
    },
  }));

  describe.skipIf(isJSDOM)('default anchor', () => {
    it('uses the input when input group is absent', async () => {
      const inputWidth = 120;
      const triggerWidth = 240;
      let anchorWidth = 0;
      const inputRef = React.createRef<HTMLInputElement>();

      await render(
        <Combobox.Root open>
          <Combobox.Input ref={inputRef} style={{ width: inputWidth }} />
          <Combobox.Trigger style={{ width: triggerWidth }}>Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner
              sideOffset={(data) => {
                anchorWidth = data.anchor.width;
                return 0;
              }}
            >
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="One">One</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      await waitFor(() => {
        expect(anchorWidth).toBeCloseTo(inputRef.current!.getBoundingClientRect().width, 0);
        expect(anchorWidth).not.toBeCloseTo(triggerWidth, 0);
      });
    });

    it('uses the input group when present', async () => {
      const inputGroupWidth = 240;
      const inputWidth = 120;
      let anchorWidth = 0;

      await render(
        <Combobox.Root open>
          <Combobox.InputGroup style={{ width: inputGroupWidth }}>
            <Combobox.Input style={{ width: inputWidth }} />
            <Combobox.Trigger>Open</Combobox.Trigger>
          </Combobox.InputGroup>
          <Combobox.Portal>
            <Combobox.Positioner
              sideOffset={(data) => {
                anchorWidth = data.anchor.width;
                return 0;
              }}
            >
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="One">One</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      await waitFor(() => {
        expect(anchorWidth).toBeCloseTo(inputGroupWidth, 0);
      });
    });
  });
});
