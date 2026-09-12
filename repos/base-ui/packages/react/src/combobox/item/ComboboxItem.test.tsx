import * as React from 'react';
import { expect, vi } from 'vitest';
import { Combobox } from '@base-ui/react/combobox';
import { fireEvent, flushMicrotasks, screen, waitFor } from '@mui/internal-test-utils';
import { createRenderer, describeConformance, isJSDOM } from '#test-utils';

describe('<Combobox.Item />', () => {
  const { render } = createRenderer();

  describeConformance(<Combobox.Item />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(<Combobox.Root>{node}</Combobox.Root>);
    },
  }));

  it('selects item and closes in single mode', async () => {
    await render(
      <Combobox.Root defaultOpen>
        <Combobox.Input data-testid="input" />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="one">one</Combobox.Item>
                <Combobox.Item value="two">two</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );

    const input = screen.getByTestId('input');
    fireEvent.click(screen.getByRole('option', { name: 'two' }));
    await flushMicrotasks();

    expect(input).toHaveValue('two');
    expect(screen.queryByRole('listbox')).toBe(null);
  });

  describe('prop: onClick', () => {
    it('calls onClick when clicked with a pointer', async () => {
      const handleClick = vi.fn();
      const { user } = await render(
        <Combobox.Root items={['apple', 'banana']} openOnInputClick>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: string) => (
                    <Combobox.Item key={item} value={item} onClick={handleClick}>
                      {item}
                    </Combobox.Item>
                  )}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');
      await user.click(input);

      const option = screen.getByRole('option', { name: 'banana' });
      await user.click(option);

      expect(handleClick.mock.calls.length).toBe(1);
    });

    it('calls onClick when selected with Enter key (via root interaction)', async () => {
      const handleClick = vi.fn();
      const { user } = await render(
        <Combobox.Root items={['one', 'two']} openOnInputClick>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: string) => (
                    <Combobox.Item key={item} value={item} onClick={handleClick}>
                      {item}
                    </Combobox.Item>
                  )}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));

      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');

      expect(handleClick.mock.calls.length).toBe(1);
    });

    it('does not select the item when onClick prevents Base UI handler', async () => {
      const handleClick = vi.fn((event) => event.preventBaseUIHandler());
      const { user } = await render(
        <Combobox.Root defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="one" onClick={handleClick}>
                    one
                  </Combobox.Item>
                  <Combobox.Item value="two">two</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const option = screen.getByRole('option', { name: 'one' });
      await user.click(option);
      await flushMicrotasks();

      const input = screen.getByTestId('input');
      expect(handleClick.mock.calls.length).toBe(1);
      expect(input).toHaveValue('');
      expect(screen.queryByRole('listbox')).not.toBe(null);
    });
  });

  it('does not select disabled item', async () => {
    await render(
      <Combobox.Root defaultOpen>
        <Combobox.Input data-testid="input" />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="one">one</Combobox.Item>
                <Combobox.Item value="two" disabled>
                  two
                </Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );

    const input = screen.getByTestId('input');
    fireEvent.click(screen.getByRole('option', { name: 'two' }));
    await flushMicrotasks();

    expect(input).toHaveValue('');
  });

  it('Enter selects highlighted item', async () => {
    const { user } = await render(
      <Combobox.Root>
        <Combobox.Input data-testid="input" />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="one">one</Combobox.Item>
                <Combobox.Item value="two">two</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );

    const input = screen.getByTestId('input');
    await user.click(input);
    await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Enter}');

    await waitFor(() => expect(input).toHaveValue('one'));
    expect(screen.queryByRole('listbox')).toBe(null);
  });

  it.skipIf(isJSDOM)('keeps the input focused after selecting an item with touch', async () => {
    const { user } = await render(
      <Combobox.Root defaultOpen>
        <Combobox.Input data-testid="input" />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="one">one</Combobox.Item>
                <Combobox.Item value="two">two</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );

    const input = screen.getByTestId('input');
    await user.click(input);
    expect(input).toHaveFocus();

    const option = screen.getByRole('option', { name: 'two' });

    await user.pointer([
      { target: option, keys: '[TouchA>]', pointerName: 'touch' },
      { target: option, keys: '[/TouchA]', pointerName: 'touch' },
    ]);

    await waitFor(() => expect(input).toHaveValue('two'));
    expect(input).toHaveFocus();
  });

  it('prevents default on mousedown so pointer selection does not steal input focus', async () => {
    await render(
      <Combobox.Root defaultOpen>
        <Combobox.Input data-testid="input" />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="one">one</Combobox.Item>
                <Combobox.Item value="two">two</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );

    const option = screen.getByRole('option', { name: 'two' });
    const mouseDown = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      button: 0,
    });

    option.dispatchEvent(mouseDown);

    expect(mouseDown.defaultPrevented).toBe(true);
  });

  it('multiple mode toggles selection and stays open', async () => {
    const { user } = await render(
      <Combobox.Root multiple>
        <Combobox.Input data-testid="input" />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="a">a</Combobox.Item>
                <Combobox.Item value="b">b</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );

    const input = screen.getByTestId('input');
    await user.click(input);
    await waitFor(() => {
      expect(screen.getByRole('listbox')).not.toBe(null);
    });

    const a = screen.getByRole('option', { name: 'a' });
    await user.click(a);
    expect(a).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('listbox')).not.toBe(null);

    await user.click(a);
    expect(a).not.toHaveAttribute('aria-selected', 'true');
  });

  it('reflects selected value with aria-selected when reopening', async () => {
    const { user } = await render(
      <Combobox.Root defaultValue="two">
        <Combobox.Input data-testid="input" />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="one">one</Combobox.Item>
                <Combobox.Item value="two">two</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );

    const input = screen.getByTestId('input');
    await user.click(input);
    await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));
    await waitFor(() =>
      expect(screen.getByRole('option', { name: 'two' })).toHaveAttribute('aria-selected', 'true'),
    );
  });

  describe.skipIf(!isJSDOM)('link handling', () => {
    it('clicking a link inside an item does not select or close (anchor with href)', async () => {
      const { user } = await render(
        <Combobox.Root defaultOpen>
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item
                    value="one"
                    render={<a href="/somewhere" />}
                    data-testid="link-one"
                  >
                    one
                  </Combobox.Item>
                  <Combobox.Item value="two">two</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');
      const link = screen.getByTestId('link-one');

      await user.click(link);

      await waitFor(() => expect(input.value).toBe(''));
      expect(screen.queryByRole('listbox')).not.toBe(null);
    });

    it('clicking a hash link inside an item does not select and closes popup (anchor with #hash)', async () => {
      const { user } = await render(
        <Combobox.Root defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="one" render={<a href="#section" />} data-testid="link-hash">
                    one
                  </Combobox.Item>
                  <Combobox.Item value="two">two</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');
      const link = screen.getByTestId('link-hash');

      await user.click(link);

      await waitFor(() => expect(input.value).toBe(''));
      expect(screen.queryByRole('listbox')).toBe(null);
    });

    it('clicking an anchor without href behaves like normal item (selects and closes)', async () => {
      const { user } = await render(
        <Combobox.Root defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="one" render={<a />} data-testid="anchor-no-href">
                    one
                  </Combobox.Item>
                  <Combobox.Item value="two">two</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');

      await user.click(screen.getByTestId('anchor-no-href'));

      await waitFor(() => expect(input.value).toBe('one'));
      expect(screen.queryByRole('listbox')).toBe(null);
    });
  });

  // Virtualized items without an explicit `index` resolve their index from the filtered set
  // (via the dedicated `ComboboxItemVirtualizedIndex` subscriber). Filtering must keep that
  // index fresh, otherwise keyboard highlight/Enter selection targets the wrong filtered item.
  describe('virtualized without explicit index', () => {
    function VirtualizedItems() {
      const items = Combobox.useFilteredItems<string>();
      return items.map((item) => (
        <Combobox.Item key={item} value={item}>
          {item}
        </Combobox.Item>
      ));
    }

    function VirtualizedCombobox() {
      return (
        <Combobox.Root virtualized items={['one', 'two', 'three', 'four', 'five']}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <VirtualizedItems />
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      );
    }

    it('selects the highlighted filtered item with the keyboard after filtering', async () => {
      const { user } = await render(<VirtualizedCombobox />);

      const input = screen.getByTestId('input');
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));

      // Narrows the list to items containing "f" ("four", "five"), which sat at full-list
      // indices 3 and 4. The first filtered item is now "four", not "one".
      await user.type(input, 'f');
      await waitFor(() => expect(screen.queryByRole('option', { name: 'one' })).toBe(null));
      expect(screen.getByRole('option', { name: 'four' })).not.toBe(null);

      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');

      await waitFor(() => expect(input).toHaveValue('four'));
      expect(screen.queryByRole('listbox')).toBe(null);
    });

    it('selects the clicked filtered item after filtering', async () => {
      const { user } = await render(<VirtualizedCombobox />);

      const input = screen.getByTestId('input');
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));

      await user.type(input, 'f');
      await waitFor(() => expect(screen.queryByRole('option', { name: 'one' })).toBe(null));

      await user.click(screen.getByRole('option', { name: 'five' }));

      await waitFor(() => expect(input).toHaveValue('five'));
      expect(screen.queryByRole('listbox')).toBe(null);
    });
  });

  // A keystroke that doesn't change which items match must not re-render the items that stay
  // mounted. Items used to re-render on every keystroke because they subscribed to the
  // derived-items context, whose identity changes per keystroke. This guards the split that keeps
  // the common (non-virtualized) path off that context so `React.memo` on `<Combobox.Item>` can
  // bail.
  describe('item re-renders on keystroke', () => {
    it('does not re-render still-mounted items when filtering keeps the same membership', async () => {
      const items = ['apple', 'apricot', 'avocado'];
      const renderSpy = vi.fn();

      const LoggingItem = React.forwardRef(function LoggingItem(
        props: any,
        ref: React.ForwardedRef<HTMLDivElement>,
      ) {
        const { state, ...other } = props;
        renderSpy();
        return <div {...other} ref={ref} />;
      });

      // Stable `render` element per item so `React.memo` can bail: a fresh element each render
      // would change the `render` prop identity and force a re-render regardless of the
      // optimization under test (`value` and the string children are already stable).
      const renderByItem = new Map(items.map((item) => [item, <LoggingItem />] as const));

      await render(
        <Combobox.Root items={items} defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: string) => (
                    <Combobox.Item key={item} value={item} render={renderByItem.get(item)}>
                      {item}
                    </Combobox.Item>
                  )}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));
      expect(screen.getAllByRole('option')).toHaveLength(3);

      renderSpy.mockClear();

      // "a" matches all three items, so the filtered set is unchanged and every item stays mounted.
      fireEvent.change(screen.getByTestId('input'), { target: { value: 'a' } });

      await waitFor(() => expect(screen.getByTestId('input')).toHaveValue('a'));
      expect(screen.getAllByRole('option')).toHaveLength(3);

      expect(renderSpy).not.toHaveBeenCalled();
    });
  });
});
