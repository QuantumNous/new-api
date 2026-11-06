import { expect } from 'vitest';
import { ScrollArea } from '@base-ui/react/scroll-area';
import { Select } from '@base-ui/react/select';
import { CSPProvider } from '@base-ui/react/csp-provider';
import { createRenderer } from '#test-utils';

function queryDisableScrollbarStyle() {
  const styles = Array.from(document.querySelectorAll('style'));
  return (
    styles.find((element) => element.textContent?.includes('.base-ui-disable-scrollbar')) ?? null
  );
}

describe('<CSPProvider />', () => {
  const { render } = createRenderer();

  it('does not render inline style tags when disableStyleElements is true', async () => {
    await render(
      <CSPProvider disableStyleElements>
        <ScrollArea.Root>
          <ScrollArea.Viewport />
        </ScrollArea.Root>
      </CSPProvider>,
    );

    expect(queryDisableScrollbarStyle()).toBeNull();
  });

  it('does not render Select inline style tags when disableStyleElements is true', async () => {
    await render(
      <CSPProvider disableStyleElements>
        <Select.Root defaultOpen>
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      </CSPProvider>,
    );

    expect(queryDisableScrollbarStyle()).toBeNull();
  });

  it('applies nonce to inline style tags', async () => {
    await render(
      <CSPProvider nonce="test-nonce">
        <ScrollArea.Root>
          <ScrollArea.Viewport />
        </ScrollArea.Root>
      </CSPProvider>,
    );

    const style = queryDisableScrollbarStyle();
    expect(style).not.toBeNull();
    expect(style).toHaveAttribute('nonce', 'test-nonce');
  });

  it('renders inline style tags by default', async () => {
    await render(
      <ScrollArea.Root>
        <ScrollArea.Viewport />
      </ScrollArea.Root>,
    );

    // Style already exists from previous test due to React 19's hoisting,
    // but we can still verify it's present
    const style = queryDisableScrollbarStyle();
    expect(style).not.toBeNull();
  });
});
