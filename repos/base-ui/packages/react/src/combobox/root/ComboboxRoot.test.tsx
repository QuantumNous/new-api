import { expect, vi } from 'vitest';
import * as React from 'react';
import {
  act,
  fireEvent,
  flushMicrotasks,
  screen,
  waitFor,
  ignoreActWarnings,
  reactMajor,
} from '@mui/internal-test-utils';
import { createRenderer, isJSDOM, popupConformanceTests } from '#test-utils';
import { Combobox } from '@base-ui/react/combobox';
import { DirectionProvider } from '@base-ui/react/direction-provider';
import { Dialog } from '@base-ui/react/dialog';
import { Field } from '@base-ui/react/field';
import { Form } from '@base-ui/react/form';
import { Input } from '@base-ui/react/input';
import { useStore } from '@base-ui/utils/store';
import { CompositeRoot } from '../../internals/composite/root/CompositeRoot';
import { CompositeItem } from '../../internals/composite/item/CompositeItem';
import { REASONS } from '../../internals/reasons';
import { useComboboxRootContext } from './ComboboxRootContext';
import { selectors } from '../store';

function AsyncItemsCombobox() {
  const [items, setItems] = React.useState(['Apple', 'Banana', 'Cherry']);
  const [selectedValue, setSelectedValue] = React.useState<string | null>(null);

  return (
    <Combobox.Root
      items={items}
      onValueChange={(value: string | null) => {
        setSelectedValue(value);
      }}
      onOpenChangeComplete={(open) => {
        if (!open && selectedValue) {
          setItems([selectedValue]);
        }
      }}
    >
      <Combobox.Input data-testid="input" />
      <Combobox.Portal>
        <Combobox.Positioner>
          <Combobox.Popup>
            <Combobox.List>
              {(item: string) => (
                <Combobox.Item key={item} value={item}>
                  {item}
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}

function SelectedIndexProbe() {
  const store = useComboboxRootContext();
  const selectedIndex = useStore(store, selectors.selectedIndex);

  return (
    <div data-testid="selected-index">{selectedIndex === null ? 'null' : `${selectedIndex}`}</div>
  );
}

function isElementOrAncestorInert(element: HTMLElement) {
  let current: HTMLElement | null = element;
  while (current) {
    if (
      current.getAttribute('aria-hidden') === 'true' ||
      current.hasAttribute('inert') ||
      current.hasAttribute('data-base-ui-inert')
    ) {
      return true;
    }
    current = current.parentElement;
  }
  return false;
}

describe('<Combobox.Root />', () => {
  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  const { render, renderToString } = createRenderer();

  popupConformanceTests({
    createComponent: (props) => (
      <Combobox.Root {...props.root}>
        <Combobox.Input data-testid="trigger" />
        <Combobox.Portal {...props.portal}>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List {...props.popup}>
                <Combobox.Item value="item">Item</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ),
    render,
    triggerMouseAction: 'click',
    expectedPopupRole: 'listbox',
    combobox: true,
  });

  describe('server-side rendering', () => {
    it('sets combobox aria attributes on the input', () => {
      renderToString(
        <Combobox.Root>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner />
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');

      expect(input).toHaveAttribute('role', 'combobox');
      expect(input).toHaveAttribute('aria-expanded', 'false');
      expect(input).toHaveAttribute('aria-autocomplete', 'list');
      expect(input).toHaveAttribute('aria-haspopup', 'listbox');
    });

    it('sets combobox aria attributes on the trigger when input is inside popup', () => {
      renderToString(
        <Combobox.Root>
          <Combobox.Trigger data-testid="trigger" />
          <Combobox.Portal>
            <Combobox.Positioner />
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const trigger = screen.getByTestId('trigger');

      expect(trigger).toHaveAttribute('role', 'combobox');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    });

    it('does not link Combobox.Label to trigger before hydration', () => {
      renderToString(
        <Combobox.Root inline>
          <Combobox.Label data-testid="label">Food</Combobox.Label>
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
          <Combobox.Input data-testid="input" />
        </Combobox.Root>,
      );

      const label = screen.getByTestId('label');
      const trigger = screen.getByTestId('trigger');

      expect(label.id).not.toBe('');
      expect(trigger.id).not.toBe('');
      expect(trigger).not.toHaveAttribute('aria-labelledby');
    });
  });

  it('does not focus input when closing via trigger click (input inside popup)', async () => {
    const { user } = await render(
      <Combobox.Root items={['One', 'Two', 'Three']}>
        <Combobox.Trigger data-testid="trigger">
          <Combobox.Value />
        </Combobox.Trigger>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup aria-label="Demo">
              <Combobox.Input data-testid="input" aria-label="combobox-input" />
              <Combobox.List>
                {(item: string) => (
                  <Combobox.Item key={item} value={item}>
                    {item}
                  </Combobox.Item>
                )}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );

    const trigger = screen.getByTestId('trigger');
    await user.click(trigger);

    expect(await screen.findByRole('listbox')).not.toBe(null);

    const input = await screen.findByRole('combobox', { name: 'combobox-input' });
    await waitFor(() => expect(input).toHaveFocus());

    await user.click(trigger);
    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });
  });

  it('does not aria-hide the input group when the input is outside the popup', async () => {
    const { user } = await render(
      <Combobox.Root items={['apple', 'banana']}>
        <Combobox.InputGroup data-testid="group">
          <Combobox.Input data-testid="input" />
          <Combobox.Trigger>Open</Combobox.Trigger>
        </Combobox.InputGroup>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="apple">apple</Combobox.Item>
                <Combobox.Item value="banana">banana</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );

    const input = screen.getByTestId('input');
    const group = screen.getByTestId('group');

    await user.click(input);
    expect(await screen.findByRole('listbox')).not.toBe(null);
    await flushMicrotasks();

    expect(input).toHaveFocus();
    expect(group).not.toHaveAttribute('aria-hidden', 'true');
  });

  it('dismisses the popup when clicking a plain wrapper around the input', async () => {
    const { user } = await render(
      <Combobox.Root items={['apple', 'banana']}>
        <div style={{ padding: 10 }}>
          <span data-testid="pad">padding</span>
          <Combobox.Input data-testid="input" />
          <Combobox.Trigger>Open</Combobox.Trigger>
        </div>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="apple">apple</Combobox.Item>
                <Combobox.Item value="banana">banana</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );

    await user.click(screen.getByRole('button', { name: 'Open' }));
    expect(await screen.findByRole('listbox')).not.toBe(null);

    await user.click(screen.getByTestId('pad'));

    await waitFor(() => {
      expect(screen.queryByRole('listbox')).toBe(null);
    });
  });

  it('does not cause infinite re-renders when items becomes undefined', async () => {
    const { rerender } = await render(
      <Combobox.Root items={[]} defaultOpen>
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List />
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );

    rerender(
      <Combobox.Root items={undefined} defaultOpen>
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List />
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );
  });

  it('hides the trigger when popup is open with input outside the popup', async () => {
    const { user } = await render(
      <div>
        <button data-testid="outside">Outside</button>
        <Combobox.Root items={['Apple', 'Banana']}>
          <Combobox.Input data-testid="input" />
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: string) => (
                    <Combobox.Item key={item} value={item}>
                      {item}
                    </Combobox.Item>
                  )}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      </div>,
    );

    await user.click(screen.getByTestId('input'));

    await waitFor(() => {
      expect(screen.queryByRole('listbox')).not.toBe(null);
    });

    const outside = screen.getByTestId('outside');
    const trigger = screen.getByTestId('trigger');

    await waitFor(() => {
      expect(isElementOrAncestorInert(outside)).toBe(true);
    });

    expect(isElementOrAncestorInert(trigger)).toBe(true);
  });

  it('does not render the start dismiss button while closed', async () => {
    await render(
      <Combobox.Root items={['Apple', 'Banana']}>
        <Combobox.Input data-testid="input" />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup data-testid="popup">
              <Combobox.List>
                {(item: string) => (
                  <Combobox.Item key={item} value={item}>
                    {item}
                  </Combobox.Item>
                )}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );

    expect(screen.queryByRole('button', { name: 'Dismiss' })).toBe(null);
  });

  it('renders internal dismiss buttons before the input and after the popup', async () => {
    const { user } = await render(
      <div>
        <button data-testid="outside">Outside</button>
        <Combobox.Root defaultOpen modal items={['Apple', 'Banana']}>
          <Combobox.Trigger>Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup data-testid="popup" aria-label="Demo">
                <Combobox.Input aria-label="Combobox input" />
                <Combobox.List>
                  {(item: string) => (
                    <Combobox.Item key={item} value={item}>
                      {item}
                    </Combobox.Item>
                  )}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      </div>,
    );

    const popup = screen.getByTestId('popup');
    const input = screen.getByRole('combobox', { name: 'Combobox input' });
    const [startDismissButton, endDismissButton] = screen.getAllByRole('button', {
      name: 'Dismiss',
    });
    const outside = screen.getByTestId('outside');

    expect(input.previousElementSibling).toBe(startDismissButton);
    expect(popup.nextElementSibling).toBe(endDismissButton);
    expect(startDismissButton).not.toHaveAttribute('tabindex');
    expect(endDismissButton).not.toHaveAttribute('tabindex');

    await waitFor(() => {
      expect(isElementOrAncestorInert(outside)).toBe(true);
    });

    await user.click(endDismissButton);

    await waitFor(() => {
      expect(screen.queryByRole('listbox')).toBe(null);
    });
  });

  it('renders an internal dismiss button for the input-outside-popup pattern', async () => {
    const { user } = await render(
      <Combobox.Root items={['Apple', 'Banana']}>
        <Combobox.Input data-testid="input" />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup data-testid="popup">
              <Combobox.List>
                {(item: string) => (
                  <Combobox.Item key={item} value={item}>
                    {item}
                  </Combobox.Item>
                )}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );

    await user.click(screen.getByTestId('input'));

    const popup = await screen.findByTestId('popup');
    const input = screen.getByTestId('input');
    const [startDismissButton, endDismissButton] = screen.getAllByRole('button', {
      name: 'Dismiss',
    });

    expect(input.previousElementSibling).toBe(startDismissButton);
    expect(popup.nextElementSibling).toBe(endDismissButton);
    expect(startDismissButton).not.toHaveAttribute('tabindex');
    expect(endDismissButton).not.toHaveAttribute('tabindex');

    await user.click(startDismissButton);

    await waitFor(() => {
      expect(screen.queryByRole('listbox')).toBe(null);
    });
  });

  describe('selection behavior', () => {
    describe('single', () => {
      it('fires onOpenChange once with reason item-press on mouse click', async () => {
        const items = ['apple', 'banana'];
        const onOpenChange = vi.fn();

        const { user } = await render(
          <Combobox.Root items={items} onOpenChange={onOpenChange}>
            <Combobox.Input />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    {(item: string) => (
                      <Combobox.Item key={item} value={item}>
                        {item}
                      </Combobox.Item>
                    )}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>,
        );

        const input = screen.getByRole('combobox');
        await user.click(input);
        expect(screen.getByRole('listbox')).not.toBe(null);

        onOpenChange.mockClear();
        await user.click(screen.getByRole('option', { name: 'apple' }));

        await waitFor(() => {
          expect(screen.queryByRole('listbox')).toBe(null);
        });

        expect(onOpenChange.mock.calls.length).toBe(1);
        expect(onOpenChange.mock.lastCall?.[0]).toBe(false);
        expect(onOpenChange.mock.lastCall?.[1].reason).toBe(REASONS.itemPress);
        expect(onOpenChange.mock.lastCall?.[1].event instanceof MouseEvent).toBe(true);
      });

      it('fires onOpenChange once with reason item-press on Enter selection', async () => {
        const items = ['apple', 'banana'];
        const onOpenChange = vi.fn();

        const { user } = await render(
          <Combobox.Root items={items} onOpenChange={onOpenChange}>
            <Combobox.Input />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    {(item: string) => (
                      <Combobox.Item key={item} value={item}>
                        {item}
                      </Combobox.Item>
                    )}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>,
        );

        const input = screen.getByRole('combobox');
        await user.click(input);
        await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));

        await user.keyboard('{ArrowDown}');
        onOpenChange.mockClear();
        await user.keyboard('{Enter}');

        await waitFor(() => {
          expect(screen.queryByRole('listbox')).toBe(null);
        });

        expect(onOpenChange.mock.calls.length).toBe(1);
        expect(onOpenChange.mock.lastCall?.[0]).toBe(false);
        expect(onOpenChange.mock.lastCall?.[1].reason).toBe(REASONS.itemPress);
        expect(onOpenChange.mock.lastCall?.[1].event instanceof KeyboardEvent).toBe(true);
      });

      it('should auto-close popup after selection when open state is uncontrolled', async () => {
        const items = ['apple', 'banana', 'cherry'];

        const { user } = await render(
          <Combobox.Root items={items}>
            <Combobox.Input data-testid="input" />
            <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    {(item: string) => (
                      <Combobox.Item key={item} value={item}>
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
        const trigger = screen.getByTestId('trigger');
        await user.click(trigger);

        expect(await screen.findByRole('listbox')).not.toBe(null);
        expect(input).toHaveAttribute('aria-expanded', 'true');

        const appleOption = await screen.findByText('apple');
        await user.click(appleOption);

        await waitFor(() => {
          expect(screen.queryByRole('listbox')).toBe(null);
        });
        expect(input).toHaveAttribute('aria-expanded', 'false');
      });

      it('syncs selected index when items change after close', async () => {
        const { user } = await render(<AsyncItemsCombobox />);

        const input = screen.getByTestId('input');
        await user.click(input);
        await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));

        await user.click(screen.getByRole('option', { name: 'Cherry' }));
        await waitFor(() => expect(screen.queryByRole('listbox')).toBe(null));

        await user.click(input);
        await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));

        const cherryOption = screen.getByRole('option', { name: 'Cherry' });
        expect(cherryOption).toHaveAttribute('data-selected', '');
      });

      it('should not auto-close popup when open state is controlled', async () => {
        const items = ['apple', 'banana', 'cherry'];

        const { user } = await render(
          <Combobox.Root items={items} open>
            <Combobox.Input data-testid="input" />
            <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    {(item: string) => (
                      <Combobox.Item key={item} value={item}>
                        {item}
                      </Combobox.Item>
                    )}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>,
        );

        await user.click(screen.getByText('apple'));
        expect(screen.getByRole('listbox')).not.toBe(null);
      });

      it('should show all items when query is empty with enhanced filter', async () => {
        const items = ['apple', 'banana', 'cherry'];

        await render(
          <Combobox.Root items={items} defaultOpen>
            <Combobox.Input data-testid="input" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    {(item: string) => (
                      <Combobox.Item key={item} value={item}>
                        {item}
                      </Combobox.Item>
                    )}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>,
        );

        expect(screen.queryByText('apple')).not.toBe(null);
        expect(screen.queryByText('banana')).not.toBe(null);
        expect(screen.queryByText('cherry')).not.toBe(null);
      });

      it('should show all items when query matches current selection', async () => {
        const items = ['apple', 'banana', 'cherry'];

        const { user } = await render(
          <Combobox.Root items={items} defaultValue="apple">
            <Combobox.Input data-testid="input" />
            <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    {(item) => (
                      <Combobox.Item key={item} value={item}>
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
        const trigger = screen.getByTestId('trigger');

        await user.click(trigger);

        const appleOption = await screen.findByText('apple');
        await user.click(appleOption);

        expect(input).toHaveValue('apple');

        await user.click(trigger);

        expect(await screen.findByText('apple')).not.toBe(null);
        expect(await screen.findByText('banana')).not.toBe(null);
        expect(await screen.findByText('cherry')).not.toBe(null);
      });

      it('should reset input value to selected value when popup closes without selection', async () => {
        const items = ['apple', 'banana', 'cherry'];
        const onInputValueChange = vi.fn();

        const { user } = await render(
          <Combobox.Root items={items} defaultValue="apple" onInputValueChange={onInputValueChange}>
            <Combobox.Input data-testid="input" />
            <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    {(item) => (
                      <Combobox.Item key={item} value={item}>
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
        const trigger = screen.getByTestId('trigger');

        await user.click(trigger);
        const appleOption = await screen.findByText('apple');
        await user.click(appleOption);

        expect(input).toHaveValue('apple');

        await user.click(trigger);
        await user.type(input, 'xyz');
        expect(input).toHaveValue('applexyz');

        await user.click(document.body);

        await waitFor(() => expect(input).toHaveValue('apple'));
        expect(onInputValueChange.mock.lastCall?.[0]).toBe('apple');
        expect(onInputValueChange.mock.lastCall?.[1].reason).toBe('none');
      });

      it('should not auto-close during browser autofill', async () => {
        const items = ['apple', 'banana', 'cherry'];

        await render(
          <Combobox.Root items={items} name="test" defaultOpen>
            <Combobox.Input data-testid="input" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    {(item: string) => (
                      <Combobox.Item key={item} value={item}>
                        {item}
                      </Combobox.Item>
                    )}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>,
        );

        expect(screen.getByRole('listbox')).not.toBe(null);

        const hiddenInput = screen.queryByRole('textbox', { hidden: true });
        fireEvent.change(hiddenInput!, { target: { value: 'apple' } });

        await flushMicrotasks();

        expect(screen.getByRole('listbox')).not.toBe(null);
      });
    });

    describe('multiple', () => {
      it('should handle multiple selection', async () => {
        const handleValueChange = vi.fn();

        const { user } = await render(
          <Combobox.Root multiple onValueChange={handleValueChange}>
            <Combobox.Input />
            <Combobox.List>
              <Combobox.Item value="a">a</Combobox.Item>
              <Combobox.Item value="b">b</Combobox.Item>
              <Combobox.Item value="c">c</Combobox.Item>
            </Combobox.List>
          </Combobox.Root>,
        );

        const optionA = screen.getByRole('option', { name: 'a' });
        await user.click(optionA);

        expect(handleValueChange.mock.calls.length).toBe(1);
        expect(handleValueChange.mock.calls[0][0]).toEqual(['a']);

        const optionB = screen.getByRole('option', { name: 'b' });
        await user.click(optionB);

        expect(handleValueChange.mock.calls.length).toBe(2);
        expect(handleValueChange.mock.calls[1][0]).toEqual(['a', 'b']);
      });

      it('resets selectedIndex when clearing all selections while open', async () => {
        const items = ['apple', 'banana', 'cherry'];

        function App() {
          const [value, setValue] = React.useState(items.slice(0, 2));

          return (
            <Combobox.Root items={items} multiple value={value} onValueChange={setValue}>
              <Combobox.Input data-testid="input" />
              <SelectedIndexProbe />
              <button type="button" data-testid="clear" onClick={() => setValue([])}>
                Clear
              </button>
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.List>
                      {(item: string) => (
                        <Combobox.Item key={item} value={item}>
                          {item}
                        </Combobox.Item>
                      )}
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          );
        }

        const { user } = await render(<App />);

        expect(screen.queryByRole('listbox')).toBe(null);

        await user.click(screen.getByTestId('input'));

        expect(await screen.findByRole('listbox')).not.toBe(null);
        expect(screen.getByTestId('selected-index').textContent).toBe('1');

        await user.click(screen.getByTestId('clear'));

        await waitFor(() => {
          expect(screen.getByTestId('selected-index').textContent).toBe('null');
        });
      });

      it('re-syncs selectedIndex after an external controlled update when closing', async () => {
        const items = ['apple', 'banana', 'cherry'];

        function App() {
          const [value, setValue] = React.useState([items[0]]);

          return (
            <Combobox.Root items={items} multiple value={value} onValueChange={setValue}>
              <Combobox.Input data-testid="input" />
              <SelectedIndexProbe />
              <button type="button" data-testid="set-external" onClick={() => setValue([items[2]])}>
                Set external
              </button>
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.List>
                      {(item: string) => (
                        <Combobox.Item key={item} value={item}>
                          {item}
                        </Combobox.Item>
                      )}
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          );
        }

        const { user } = await render(<App />);

        const input = screen.getByTestId('input');
        await user.click(input);
        expect(await screen.findByRole('listbox')).not.toBe(null);

        await waitFor(() => {
          expect(screen.getByTestId('selected-index').textContent).toBe('0');
        });

        await user.click(screen.getByTestId('set-external'));
        await waitFor(() => {
          expect(screen.queryByRole('listbox')).toBe(null);
          expect(screen.getByTestId('selected-index').textContent).toBe('2');
        });

        await user.click(input);
        expect(await screen.findByRole('listbox')).not.toBe(null);

        await waitFor(() => {
          expect(screen.getByTestId('selected-index').textContent).toBe('2');
        });
      });

      it('should create multiple hidden inputs for form submission', async () => {
        const items = ['a', 'b', 'c'];
        await render(
          <Combobox.Root multiple value={items} name="languages">
            <Combobox.Input />
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

        items.forEach((item) => {
          const input = screen.getByDisplayValue(item);
          expect(input).toHaveAttribute('type', 'hidden');
          expect(input.tagName).toBe('INPUT');
        });
      });

      it('does not submit multiple values when disabled', async () => {
        await render(
          <form data-testid="form">
            <Combobox.Root multiple disabled name="x" defaultValue={['a']}>
              <Combobox.Input />
            </Combobox.Root>
          </form>,
        );

        const form = screen.getByTestId<HTMLFormElement>('form');

        expect(new FormData(form).getAll('x')).toEqual([]);
      });

      it('should handle disabled state with chips', async () => {
        const { user } = await render(
          <Combobox.Root multiple disabled defaultValue={['a', 'b']}>
            <Combobox.Input data-testid="input" />
            <Combobox.Chips>
              <Combobox.Chip data-testid="chip-a">
                <Combobox.ChipRemove data-testid="remove-a" />
              </Combobox.Chip>
              <Combobox.Chip data-testid="chip-b">
                <Combobox.ChipRemove data-testid="remove-b" />
              </Combobox.Chip>
            </Combobox.Chips>
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    <Combobox.Item value="a">a</Combobox.Item>
                    <Combobox.Item value="b">b</Combobox.Item>
                    <Combobox.Item value="c">c</Combobox.Item>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>,
        );

        const chipA = screen.getByTestId('chip-a');
        const removeA = screen.getByTestId('remove-a');

        expect(chipA).toHaveAttribute('aria-disabled', 'true');
        expect(removeA).toHaveAttribute('aria-disabled', 'true');

        await user.click(removeA);
        expect(screen.getByTestId('chip-a')).not.toBe(null);
      });

      it('should handle readOnly state with chips', async () => {
        const { user } = await render(
          <Combobox.Root multiple readOnly defaultValue={['a', 'b']}>
            <Combobox.Input data-testid="input" />
            <Combobox.Chips>
              <Combobox.Chip data-testid="chip-a">
                <Combobox.ChipRemove data-testid="remove-a" />
              </Combobox.Chip>
              <Combobox.Chip data-testid="chip-b">
                <Combobox.ChipRemove data-testid="remove-b" />
              </Combobox.Chip>
            </Combobox.Chips>
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    <Combobox.Item value="a">a</Combobox.Item>
                    <Combobox.Item value="b">b</Combobox.Item>
                    <Combobox.Item value="c">c</Combobox.Item>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>,
        );

        const chipA = screen.getByTestId('chip-a');
        const removeA = screen.getByTestId('remove-a');

        expect(chipA).toHaveAttribute('aria-readonly', 'true');

        await user.click(removeA);
        expect(screen.getByTestId('chip-a')).not.toBe(null);
      });
    });
  });

  describe('keyboard interaction', () => {
    it('focuses first item on ArrowDown and last item on ArrowUp', async () => {
      const { user } = await render(
        <Combobox.Root>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="apple">apple</Combobox.Item>
                  <Combobox.Item value="banana">banana</Combobox.Item>
                  <Combobox.Item value="cherry">cherry</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');

      await act(async () => input.focus());

      await user.keyboard('{ArrowDown}');
      await waitFor(() => {
        const first = screen.getByRole('option', { name: 'apple' });
        expect(input).toHaveAttribute('aria-activedescendant', first.id);
      });

      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBe(null);
      });

      await user.keyboard('{ArrowUp}');

      await waitFor(() => {
        const last = screen.getByRole('option', { name: 'cherry' });
        expect(input).toHaveAttribute('aria-activedescendant', last.id);
      });
    });

    it('opens, navigates with ArrowDown, and Enter selects', async () => {
      const items = ['apple', 'banana', 'cherry'];

      const { user } = await render(
        <Combobox.Root items={items}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: string) => (
                    <Combobox.Item key={item} value={item}>
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

      // Highlight first item and select it
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');

      expect(screen.queryByRole('listbox')).toBe(null);
      expect(input).toHaveValue('apple');
    });

    it('Enter selects with manual indices provided to items', async () => {
      const items = ['apple', 'banana', 'cherry'];

      const { user } = await render(
        <Combobox.Root items={items}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: string, index: number) => (
                    <Combobox.Item key={item} value={item} index={index}>
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
      await waitFor(() => {
        expect(screen.getByRole('listbox')).not.toBe(null);
      });

      await user.type(input, 'c'); // filter to "cherry"
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(input).toHaveValue('cherry');
      });
    });

    it('clicking on "listbox" keeps the focus on the input', async () => {
      const items = ['apple', 'banana', 'cherry'];

      const { user } = await render(
        <Combobox.Root items={items}>
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: string) => (
                    <Combobox.Item key={item} value={item}>
                      {item}
                    </Combobox.Item>
                  )}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByRole('combobox');

      await user.click(input);
      await waitFor(() => {
        expect(screen.getByRole('listbox')).not.toBe(null);
      });

      const listbox = screen.getByRole('listbox');
      await user.click(listbox);
      expect(input).toHaveFocus();

      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(input).toHaveValue('apple');
      });
    });

    it('Escape closes the popup without committing when nothing highlighted', async () => {
      const { user } = await render(
        <Combobox.Root defaultOpen items={['a', 'b']}>
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
      expect(screen.queryByRole('listbox')).not.toBe(null);

      await user.keyboard('{Escape}');
      expect(screen.queryByRole('listbox')).toBe(null);
      expect(input).toHaveValue('');
    });

    it('bubbles Escape key when rendered inline without Positioner/Popup', async () => {
      const onOuterKeyDown = vi.fn();

      const { user } = await render(
        <div
          data-testid="outer"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              onOuterKeyDown();
            }
          }}
        >
          <Combobox.Root inline defaultOpen>
            <Combobox.Input data-testid="input" />
            <Combobox.List>
              <Combobox.Item value="a">a</Combobox.Item>
              <Combobox.Item value="b">b</Combobox.Item>
            </Combobox.List>
          </Combobox.Root>
        </div>,
      );

      const input = screen.getByTestId('input');
      await user.click(input);

      await waitFor(() => {
        expect(screen.getByRole('listbox')).not.toBe(null);
      });

      await user.keyboard('{Escape}');

      expect(onOuterKeyDown.mock.calls.length).toBe(1);
    });

    it('keeps input value on Enter when inline and no item is highlighted', async () => {
      const { user } = await render(
        <Combobox.Root inline items={['Apple', 'Banana']}>
          <Combobox.Input data-testid="input" />
          <Combobox.List>
            {(item: string) => (
              <Combobox.Item key={item} value={item}>
                {item}
              </Combobox.Item>
            )}
          </Combobox.List>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');

      await user.click(input);
      await user.type(input, 'Ba');

      expect(input).not.toHaveAttribute('aria-activedescendant');
      expect(input).toHaveValue('Ba');

      await user.keyboard('{Enter}');

      expect(input).toHaveValue('Ba');
    });

    it('bubbles Escape key when list is empty and popup hidden with CSS', async () => {
      const onOuterKeyDown = vi.fn();

      const { user } = await render(
        <div
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              onOuterKeyDown();
            }
          }}
        >
          <Combobox.Root defaultOpen items={[]}>
            <Combobox.Input />
            <Combobox.Portal>
              <Combobox.Positioner data-testid="positioner">
                <Combobox.Popup>
                  <Combobox.List>
                    {(item: string) => (
                      <Combobox.Item key={item} value={item}>
                        {item}
                      </Combobox.Item>
                    )}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        </div>,
      );

      const positioner = await screen.findByTestId('positioner');
      positioner.style.display = 'none';

      const input = screen.getByRole('combobox');
      await user.click(input);
      await user.keyboard('{Escape}');

      expect(onOuterKeyDown.mock.calls.length).toBe(1);
    });

    it('does not bubble Escape key when Empty component is present', async () => {
      const onOuterKeyDown = vi.fn();

      const { user } = await render(
        <div
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              onOuterKeyDown();
            }
          }}
        >
          <Combobox.Root defaultOpen items={[]}>
            <Combobox.Input />
            <Combobox.Portal>
              <Combobox.Positioner data-testid="positioner">
                <Combobox.Popup>
                  <Combobox.List>
                    {(item: string) => (
                      <Combobox.Item key={item} value={item}>
                        {item}
                      </Combobox.Item>
                    )}
                  </Combobox.List>
                  <Combobox.Empty>No results.</Combobox.Empty>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        </div>,
      );

      const positioner = await screen.findByTestId('positioner');
      positioner.style.display = 'none';

      const input = screen.getByRole('combobox');
      await user.click(input);
      await user.keyboard('{Escape}');

      expect(onOuterKeyDown.mock.calls.length).toBe(0);
    });
  });

  describe('aria attributes', () => {
    it('sets all aria attributes on the input when closed', async () => {
      await render(
        <Combobox.Root>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner />
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');

      expect(input).toHaveAttribute('role', 'combobox');
      expect(input).toHaveAttribute('aria-expanded', 'false');
      expect(input).toHaveAttribute('aria-autocomplete', 'list');
      expect(input).toHaveAttribute('aria-haspopup', 'listbox');
      expect(input).not.toHaveAttribute('aria-controls');
      expect(input).not.toHaveAttribute('aria-activedescendant');
    });

    it('sets all aria attributes on the input when open', async () => {
      await render(
        <Combobox.Root defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List />
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');
      const listbox = screen.getByRole('listbox');

      expect(input).toHaveAttribute('role', 'combobox');
      expect(input).toHaveAttribute('aria-expanded', 'true');
      expect(input).toHaveAttribute('aria-autocomplete', 'list');
      expect(input).toHaveAttribute('aria-haspopup', 'listbox');
      expect(input).toHaveAttribute('aria-controls', listbox.id);
      expect(input).not.toHaveAttribute('aria-activedescendant');
    });

    it('sets correct attributes on the item when highlighted', async () => {
      const { user } = await render(
        <Combobox.Root defaultOpen>
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

      const input = screen.getByRole('combobox');

      await user.click(input);

      expect(input).not.toHaveAttribute('aria-activedescendant');

      await user.keyboard('{ArrowDown}');

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'a' })).toHaveAttribute('aria-selected', 'false');
      });
      expect(screen.getByRole('option', { name: 'b' })).toHaveAttribute('aria-selected', 'false');
      expect(input).toHaveAttribute(
        'aria-activedescendant',
        screen.getByRole('option', { name: 'a' }).id,
      );

      await user.keyboard('{Enter}');
      await user.click(input);

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'a' })).toHaveAttribute('aria-selected', 'true');
      });
      expect(screen.getByRole('option', { name: 'b' })).toHaveAttribute('aria-selected', 'false');
    });

    it('sets aria-controls to the dialog popup on trigger', async () => {
      const { user } = await render(
        <Combobox.Root defaultOpen>
          <Combobox.Trigger>trigger</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Input data-testid="input" />
                <Combobox.List />
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const trigger = screen
        .getAllByRole('combobox')
        .find((element) => element.tagName === 'BUTTON')!;
      const popup = screen.getByRole('dialog');

      expect(popup.id).not.toBe('');
      expect(trigger).toHaveAttribute('aria-controls', popup.id);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');

      await user.click(trigger);

      await waitFor(() => {
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
      });
      expect(trigger).not.toHaveAttribute('aria-controls');
    });

    it('points aria-controls at a custom popup id on the trigger', async () => {
      await render(
        <Combobox.Root defaultOpen>
          <Combobox.Trigger>trigger</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup id="custom-popup-id">
                <Combobox.Input data-testid="input" />
                <Combobox.List />
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const trigger = screen
        .getAllByRole('combobox')
        .find((element) => element.tagName === 'BUTTON')!;
      const popup = screen.getByRole('dialog');

      expect(popup.id).toBe('custom-popup-id');
      expect(trigger).toHaveAttribute('aria-controls', 'custom-popup-id');
    });

    it('points aria-controls at a popup id supplied through the render prop', async () => {
      await render(
        <Combobox.Root defaultOpen>
          <Combobox.Trigger>trigger</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup render={<div id="custom-render-id" />}>
                <Combobox.Input data-testid="input" />
                <Combobox.List />
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const trigger = screen
        .getAllByRole('combobox')
        .find((element) => element.tagName === 'BUTTON')!;
      const popup = screen.getByRole('dialog');

      expect(popup.id).toBe('custom-render-id');
      expect(trigger).toHaveAttribute('aria-controls', 'custom-render-id');
    });
  });

  it('should handle browser autofill', async () => {
    const onInputValueChange = vi.fn();
    const { user } = await render(
      <Combobox.Root name="test" onInputValueChange={onInputValueChange}>
        <Combobox.Input />
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

    const input = screen.getByRole('combobox');

    fireEvent.change(
      screen.getAllByDisplayValue('').find((el) => el.getAttribute('name') === 'test')!,
      { target: { value: 'b' } },
    );
    await flushMicrotasks();
    expect(onInputValueChange.mock.lastCall?.[0]).toBe('b');
    expect(onInputValueChange.mock.lastCall?.[1].reason).toBe(REASONS.none);

    await user.click(input);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'b' })).toHaveAttribute('aria-selected', 'true');
    });
  });

  it.each([
    { lockState: 'readOnly', label: 'inside Field', withField: true },
    { lockState: 'disabled', label: 'inside Field', withField: true },
    { lockState: 'readOnly', label: 'outside Field', withField: false },
    { lockState: 'disabled', label: 'outside Field', withField: false },
  ] as const)(
    'ignores hidden-input autofill when $lockState $label',
    async ({ lockState, withField }) => {
      const onValueChange = vi.fn();
      const onInputValueChange = vi.fn();
      const combobox = (
        <Combobox.Root
          name={withField ? undefined : 'test'}
          readOnly={lockState === 'readOnly'}
          disabled={lockState === 'disabled'}
          onValueChange={onValueChange}
          onInputValueChange={onInputValueChange}
        >
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
        </Combobox.Root>
      );

      await render(
        withField ? (
          <Form errors={{ test: 'test' }}>
            <Field.Root name="test">
              {combobox}
              <Field.Error data-testid="error" />
            </Field.Root>
          </Form>
        ) : (
          combobox
        ),
      );

      const visibleInput = screen.getByTestId<HTMLInputElement>('input');
      const hiddenInput = screen
        .getAllByDisplayValue('')
        .find((el) => el.getAttribute('name') === 'test') as HTMLInputElement;
      expect(hiddenInput).not.toBeUndefined();

      if (withField) {
        expect(screen.getByTestId('error')).toHaveTextContent('test');
      }

      fireEvent.change(hiddenInput, { target: { value: 'b' } });
      await flushMicrotasks();

      expect(onValueChange).not.toHaveBeenCalled();
      expect(onInputValueChange).not.toHaveBeenCalled();
      expect(visibleInput.value).toBe('');
      expect(hiddenInput.value).toBe('');

      if (withField) {
        expect(screen.getByTestId('error')).toHaveTextContent('test');
      }
    },
  );

  it('shows all items when opening after browser autofill', async () => {
    const items = ['a', 'b', 'c'];
    const { user } = await render(
      <Combobox.Root name="test" items={items}>
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                {(item: string) => (
                  <Combobox.Item key={item} value={item}>
                    {item}
                  </Combobox.Item>
                )}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );

    const input = screen.getByRole('combobox');

    fireEvent.change(
      screen.getAllByDisplayValue('').find((el) => el.getAttribute('name') === 'test')!,
      { target: { value: 'b' } },
    );
    await flushMicrotasks();

    await user.click(input);

    await waitFor(() => {
      expect(screen.getByRole('listbox')).not.toBe(null);
    });
    expect(screen.getByRole('option', { name: 'a' })).not.toBe(null);
    expect(screen.getByRole('option', { name: 'b' })).not.toBe(null);
    expect(screen.getByRole('option', { name: 'c' })).not.toBe(null);
  });

  it('shows all items when opening after browser autofill with insertReplacementText', async () => {
    const items = ['a', 'b', 'c'];
    const { user } = await render(
      <Combobox.Root name="test" items={items}>
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                {(item: string) => (
                  <Combobox.Item key={item} value={item}>
                    {item}
                  </Combobox.Item>
                )}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );

    const input = screen.getByRole('combobox');

    fireEvent.input(
      screen.getAllByDisplayValue('').find((el) => el.getAttribute('name') === 'test')!,
      { target: { value: 'b' }, inputType: 'insertReplacementText' },
    );
    await flushMicrotasks();

    await user.click(input);

    await waitFor(() => {
      expect(screen.getByRole('listbox')).not.toBe(null);
    });
    expect(screen.getByRole('option', { name: 'a' })).not.toBe(null);
    expect(screen.getByRole('option', { name: 'b' })).not.toBe(null);
    expect(screen.getByRole('option', { name: 'c' })).not.toBe(null);
  });

  it('should handle browser autofill with object values', async () => {
    const items = [
      { country: 'United States', code: 'US' },
      { country: 'Canada', code: 'CA' },
    ];

    await render(
      <Combobox.Root
        name="country"
        items={items}
        itemToStringLabel={(item: (typeof items)[number]) => item.country}
        itemToStringValue={(item: (typeof items)[number]) => item.code}
        defaultOpen
      >
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                {(item: (typeof items)[1]) => (
                  <Combobox.Item key={item.code} value={item}>
                    {item.country}
                  </Combobox.Item>
                )}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );

    const input = screen.getByRole('combobox');

    fireEvent.change(
      // getByRole('textbox', { hidden: true, name: 'country' }) does not work
      screen.getAllByDisplayValue('').find((el) => el.getAttribute('name') === 'country')!,
      { target: { value: 'CA' } },
    );
    await flushMicrotasks();

    fireEvent.click(input);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Canada' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    });
  });

  it('should handle browser autofill with object values when autofill uses the label', async () => {
    // Browsers autofill with the displayed text (label), not the underlying value.
    // For example, Chrome will autofill "United States" (the label), not "US" (the value).
    const items = [
      { country: 'United States', code: 'US' },
      { country: 'Canada', code: 'CA' },
    ];

    const onValueChange = vi.fn();

    await render(
      <Combobox.Root
        name="country"
        items={items}
        itemToStringLabel={(item: (typeof items)[number]) => item.country}
        itemToStringValue={(item: (typeof items)[number]) => item.code}
        onValueChange={onValueChange}
        defaultOpen
      >
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                {(item: (typeof items)[1]) => (
                  <Combobox.Item key={item.code} value={item}>
                    {item.country}
                  </Combobox.Item>
                )}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );

    const input = screen.getByRole('combobox');

    // Simulate browser autofill with the LABEL (displayed text), not the value
    fireEvent.change(
      screen.getAllByDisplayValue('').find((el) => el.getAttribute('name') === 'country')!,
      { target: { value: 'Canada' } }, // Browser sends "Canada" (label), not "CA" (value)
    );
    await flushMicrotasks();

    // onValueChange should be called with the matching object
    expect(onValueChange).toHaveBeenCalledWith(
      { country: 'Canada', code: 'CA' },
      expect.objectContaining({ reason: REASONS.none }),
    );

    fireEvent.click(input);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Canada' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    });
  });

  it('matches browser autofill against an item rendered label for primitive values regardless of case', async () => {
    const { user } = await render(
      <Combobox.Root name="country">
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="US">United States</Combobox.Item>
                <Combobox.Item value="CA">Canada</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );

    const input = screen.getByRole('combobox');
    const hiddenInput = screen
      .getAllByDisplayValue('')
      .find((el) => el.getAttribute('name') === 'country') as HTMLInputElement;

    // The browser autofills the rendered text ("Canada"), not the value ("CA").
    fireEvent.change(hiddenInput, { target: { value: 'canada' } });
    await flushMicrotasks();

    await user.click(input);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Canada' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    });
  });

  it('matches browser autofill by serialized value before an earlier rendered label', async () => {
    const { user } = await render(
      <Combobox.Root name="country">
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="CA">US</Combobox.Item>
                <Combobox.Item value="US">United States</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );

    const input = screen.getByRole('combobox');
    const hiddenInput = screen
      .getAllByDisplayValue('')
      .find((el) => el.getAttribute('name') === 'country') as HTMLInputElement;

    fireEvent.change(hiddenInput, { target: { value: 'US' } });
    await flushMicrotasks();

    await user.click(input);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'United States' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    });
    expect(screen.getByRole('option', { name: 'US' })).toHaveAttribute('aria-selected', 'false');
  });

  it('matches browser autofill when an earlier item has no rendered label', async () => {
    const { user } = await render(
      <Combobox.Root name="country">
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="US">{null}</Combobox.Item>
                <Combobox.Item value="CA">Canada</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );

    const input = screen.getByRole('combobox');
    const hiddenInput = screen
      .getAllByDisplayValue('')
      .find((el) => el.getAttribute('name') === 'country') as HTMLInputElement;

    fireEvent.change(hiddenInput, { target: { value: 'Canada' } });
    await flushMicrotasks();

    await user.click(input);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Canada' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    });
  });

  it('matches browser autofill against an item rendered label when using the items prop', async () => {
    const countryNames: Record<string, string> = {
      US: 'United States',
      CA: 'Canada',
    };

    const { user } = await render(
      <Combobox.Root name="country" items={['US', 'CA']}>
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                {(code: string) => (
                  <Combobox.Item key={code} value={code}>
                    {countryNames[code]}
                  </Combobox.Item>
                )}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );

    const input = screen.getByRole('combobox');
    const hiddenInput = screen
      .getAllByDisplayValue('')
      .find((el) => el.getAttribute('name') === 'country') as HTMLInputElement;

    fireEvent.change(hiddenInput, { target: { value: 'Canada' } });
    await flushMicrotasks();

    await user.click(input);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Canada' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    });
  });

  it('does not force-mount the list when autofill matches a serialized value with the items prop', async () => {
    const { user } = await render(
      <Combobox.Root name="country" items={['US', 'CA']}>
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                {(code: string) => (
                  <Combobox.Item key={code} value={code}>
                    {code}
                  </Combobox.Item>
                )}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );

    const input = screen.getByRole('combobox');
    const hiddenInput = screen
      .getAllByDisplayValue('')
      .find((el) => el.getAttribute('name') === 'country') as HTMLInputElement;

    fireEvent.change(hiddenInput, { target: { value: 'CA' } });
    await flushMicrotasks();

    // The serialized value matched directly, so the popup must not be force-mounted.
    expect(document.querySelector('[role="listbox"]')).toBe(null);

    await user.click(input);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'CA' })).toHaveAttribute('aria-selected', 'true');
    });
  });

  it('marks the field dirty and validates after successful autofill', async () => {
    const validateSpy = vi.fn((value: unknown) => {
      return value === 'CA' ? null : 'error';
    });

    await render(
      <Field.Root validationMode="onChange" validate={validateSpy}>
        <Combobox.Root name="country">
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="US">United States</Combobox.Item>
                  <Combobox.Item value="CA">Canada</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      </Field.Root>,
    );

    const input = screen.getByTestId('input');
    const hiddenInput = screen
      .getAllByDisplayValue('')
      .find((el) => el.getAttribute('name') === 'country') as HTMLInputElement;

    expect(input).not.toHaveAttribute('data-dirty');

    fireEvent.change(hiddenInput, { target: { value: 'CA' } });
    await flushMicrotasks();

    await waitFor(() => {
      expect(validateSpy).toHaveBeenCalled();
    });

    expect(validateSpy.mock.calls[validateSpy.mock.calls.length - 1][0]).toBe('CA');
    expect(input).toHaveAttribute('data-dirty', '');
  });

  it('does not update field state when autofill is canceled', async () => {
    await render(
      <Form errors={{ country: 'server error' }}>
        <Field.Root name="country">
          <Combobox.Root
            onValueChange={(_value, eventDetails) => {
              eventDetails.cancel();
            }}
          >
            <Combobox.Trigger data-testid="trigger" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.Input />
                  <Combobox.List>
                    <Combobox.Item value="US">United States</Combobox.Item>
                    <Combobox.Item value="CA">Canada</Combobox.Item>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
          <Field.Error data-testid="error" />
        </Field.Root>
      </Form>,
    );

    const trigger = screen.getByTestId('trigger');
    const hiddenInput = screen
      .getAllByDisplayValue('')
      .find((el) => el.getAttribute('name') === 'country') as HTMLInputElement;

    expect(trigger).not.toHaveAttribute('data-dirty');
    expect(screen.getByTestId('error')).toHaveTextContent('server error');

    fireEvent.change(hiddenInput, { target: { value: 'CA' } });
    await flushMicrotasks();

    // The change was canceled, so the value never changed and the field keeps its state.
    expect(trigger).not.toHaveAttribute('data-dirty');
    expect(screen.getByTestId('error')).toHaveTextContent('server error');
  });

  it('does not mark the field dirty when input autofill is canceled', async () => {
    await render(
      <Field.Root>
        <Combobox.Root
          name="country"
          onValueChange={(_value, eventDetails) => {
            eventDetails.cancel();
          }}
        >
          <Combobox.Trigger data-testid="trigger" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Input />
                <Combobox.List>
                  <Combobox.Item value="US">United States</Combobox.Item>
                  <Combobox.Item value="CA">Canada</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      </Field.Root>,
    );

    const trigger = screen.getByTestId('trigger');
    const hiddenInput = screen
      .getAllByDisplayValue('')
      .find((el) => el.getAttribute('name') === 'country') as HTMLInputElement;

    expect(trigger).not.toHaveAttribute('data-dirty');

    fireEvent.change(hiddenInput, { target: { value: 'CA' } });
    await flushMicrotasks();

    // The change was canceled, so the value never changed and the field stays pristine.
    expect(trigger).not.toHaveAttribute('data-dirty');
  });

  it('should pass autoComplete to the hidden input', async () => {
    await render(
      <Combobox.Root name="country" autoComplete="country">
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="US">United States</Combobox.Item>
                <Combobox.Item value="CA">Canada</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );

    const input = screen.getByRole('combobox');
    const hiddenInput = screen.getByRole('textbox', { hidden: true });

    expect(input).toHaveAttribute('autocomplete', 'off');
    expect(input).not.toHaveAttribute('name');
    expect(hiddenInput).toHaveAttribute('name', 'country');
    expect(hiddenInput).not.toHaveAttribute('id');
    expect(hiddenInput).toHaveAttribute('autocomplete', 'country');
  });

  describe.skipIf(isJSDOM)('scroll locking', () => {
    describe('touch scroll lock', () => {
      it('applies scroll lock when a touch-opened popup covers the viewport width', async () => {
        await render(
          <Combobox.Root modal items={['Apple']}>
            <Combobox.Input />
            <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
            <Combobox.Portal>
              <Combobox.Positioner data-testid="positioner" style={{ width: 'calc(100vw - 10px)' }}>
                <Combobox.Popup>
                  <Combobox.List>
                    <Combobox.Item value="Apple">Apple</Combobox.Item>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>,
        );

        const trigger = screen.getByTestId('trigger');

        fireEvent.pointerDown(trigger, { pointerType: 'touch' });
        fireEvent.mouseDown(trigger);

        await screen.findByRole('listbox');

        await waitFor(() => {
          const isScrollLocked =
            trigger.ownerDocument.documentElement.style.overflow === 'hidden' ||
            trigger.ownerDocument.documentElement.hasAttribute('data-base-ui-scroll-locked') ||
            trigger.ownerDocument.body.style.overflow === 'hidden';

          expect(isScrollLocked).toBe(true);
        });
      });

      it('does not apply scroll lock when a touch-opened popup is narrower than the viewport', async () => {
        await render(
          <Combobox.Root modal items={['Apple']}>
            <Combobox.Input />
            <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
            <Combobox.Portal>
              <Combobox.Positioner data-testid="positioner" style={{ width: '240px' }}>
                <Combobox.Popup>
                  <Combobox.List>
                    <Combobox.Item value="Apple">Apple</Combobox.Item>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>,
        );

        const trigger = screen.getByTestId('trigger');

        fireEvent.pointerDown(trigger, { pointerType: 'touch' });
        fireEvent.mouseDown(trigger);

        await screen.findByRole('listbox');

        await act(async () => {
          await new Promise<void>((resolve) => {
            requestAnimationFrame(() => resolve());
          });
        });

        const isScrollLocked =
          trigger.ownerDocument.documentElement.style.overflow === 'hidden' ||
          trigger.ownerDocument.documentElement.hasAttribute('data-base-ui-scroll-locked') ||
          trigger.ownerDocument.body.style.overflow === 'hidden';

        expect(isScrollLocked).toBe(false);
      });
    });
  });

  it('does not open on programmatic input events', async () => {
    await render(
      <Combobox.Root>
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="Darlinghurst">Darlinghurst</Combobox.Item>
                <Combobox.Item value="Sydney">Sydney</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );

    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'Darlinghurst' } });
    await flushMicrotasks();

    expect(screen.queryByRole('listbox')).toBe(null);
  });

  it('opens on paste input events', async () => {
    await render(
      <Combobox.Root>
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="Darlinghurst">Darlinghurst</Combobox.Item>
                <Combobox.Item value="Sydney">Sydney</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );

    const input = screen.getByRole('combobox');
    fireEvent.input(input, {
      target: { value: 'Darlinghurst' },
      inputType: 'insertFromPaste',
    });

    await waitFor(() => {
      expect(screen.getByRole('listbox')).not.toBe(null);
    });
  });

  describe('prop: id', () => {
    it('sets the id on the input when it is outside the popup', async () => {
      await render(
        <Combobox.Root id="test-id">
          <Combobox.Input />
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

      const input = screen.getByRole('combobox');
      await waitFor(() => {
        expect(input).toHaveAttribute('id', 'test-id');
      });
    });

    it('sets the id on the trigger when the input is inside the popup', async () => {
      await render(
        <Combobox.Root id="test-id" defaultOpen>
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Input data-testid="input" />
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                  <Combobox.Item value="b">b</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      const input = screen.getByTestId('input');

      expect(trigger).toHaveAttribute('id', 'test-id');
      expect(input).not.toHaveAttribute('id', 'test-id');
    });
  });

  describe('prop: disabled', () => {
    it('should render disabled state on all interactive components', async () => {
      const { user } = await render(
        <Combobox.Root disabled>
          <Combobox.Input data-testid="input" />
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a" data-testid="item-a">
                    a
                  </Combobox.Item>
                  <Combobox.Item value="b" data-testid="item-b">
                    b
                  </Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');
      const trigger = screen.getByTestId('trigger');

      expect(input).toHaveAttribute('disabled');
      expect(trigger).toHaveAttribute('disabled');

      // Verify interactions are disabled
      await user.click(trigger);
      expect(screen.queryByRole('listbox')).toBe(null);
    });

    it('should not open popup when disabled', async () => {
      const { user } = await render(
        <Combobox.Root disabled>
          <Combobox.Input data-testid="input" />
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
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
      const trigger = screen.getByTestId('trigger');

      await user.click(input);
      expect(screen.queryByRole('listbox')).toBe(null);

      await user.click(trigger);
      expect(screen.queryByRole('listbox')).toBe(null);
    });

    it('should prevent keyboard interactions when disabled', async () => {
      const { user } = await render(
        <Combobox.Root disabled>
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

      await user.type(input, 'a');
      expect(screen.queryByRole('listbox')).toBe(null);
    });

    it('should set disabled attribute on hidden input', async () => {
      await render(
        <Combobox.Root disabled name="test">
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const hiddenInput = screen.getByRole('textbox', { hidden: true });
      expect(hiddenInput).toHaveAttribute('disabled');
    });
  });

  describe('prop: required', () => {
    it('does not mark the hidden input as required when selection exists in multiple mode', async () => {
      await render(
        <Combobox.Root multiple required name="languages" value={['a']}>
          <Combobox.Input />
        </Combobox.Root>,
      );

      const hiddenInput = screen.getByRole('textbox', { hidden: true });
      expect(hiddenInput).not.toBe(null);
      expect(hiddenInput).not.toHaveAttribute('required');
    });

    it('keeps the hidden input required when no selection exists in multiple mode', async () => {
      await render(
        <Combobox.Root multiple required name="languages" value={[]}>
          <Combobox.Input />
        </Combobox.Root>,
      );

      const hiddenInput = screen.getByRole('textbox', { hidden: true });
      expect(hiddenInput).not.toBe(null);
      expect(hiddenInput).toHaveAttribute('required');
    });
  });

  describe('prop: readOnly', () => {
    it('should render readOnly state on the input and disable interactions', async () => {
      const { user } = await render(
        <Combobox.Root readOnly>
          <Combobox.Input data-testid="input" />
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a" data-testid="item-a">
                    a
                  </Combobox.Item>
                  <Combobox.Item value="b" data-testid="item-b">
                    b
                  </Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');
      const trigger = screen.getByTestId('trigger');

      expect(input).toHaveAttribute('aria-readonly', 'true');
      expect(input).toHaveAttribute('readonly');

      // Verify interactions are disabled
      await user.click(trigger);
      expect(screen.queryByRole('listbox')).toBe(null);
    });

    it('should not open popup when readOnly', async () => {
      const { user } = await render(
        <Combobox.Root readOnly>
          <Combobox.Input data-testid="input" />
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
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
      const trigger = screen.getByTestId('trigger');

      await user.click(input);
      expect(screen.queryByRole('listbox')).toBe(null);

      await user.click(trigger);
      expect(screen.queryByRole('listbox')).toBe(null);
    });

    it('should prevent keyboard interactions when readOnly', async () => {
      const { user } = await render(
        <Combobox.Root readOnly>
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

      await user.type(input, 'a');
      expect(screen.queryByRole('listbox')).toBe(null);
    });

    it('should set readOnly attribute on hidden input', async () => {
      await render(
        <Combobox.Root readOnly name="test">
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const hiddenInput = screen.getByRole('textbox', { hidden: true });
      expect(hiddenInput).toHaveAttribute('readonly');
    });

    it('should prevent value changes when readOnly with items', async () => {
      const handleValueChange = vi.fn();
      const { user } = await render(
        <Combobox.Root readOnly onValueChange={handleValueChange} defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a" data-testid="item-a">
                    a
                  </Combobox.Item>
                  <Combobox.Item value="b" data-testid="item-b">
                    b
                  </Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const itemA = screen.getByTestId('item-a');
      await user.click(itemA);

      expect(handleValueChange.mock.calls.length).toBe(0);
    });
  });

  describe('prop: itemToStringLabel', () => {
    const items = [
      { country: 'United States', code: 'US' },
      { country: 'Canada', code: 'CA' },
      { country: 'Australia', code: 'AU' },
    ];

    it('uses itemToStringLabel for input value synchronization', async () => {
      const { user } = await render(
        <Combobox.Root
          items={items}
          itemToStringLabel={(item: (typeof items)[number]) => item.country}
          itemToStringValue={(item: (typeof items)[number]) => item.code}
          defaultOpen
        >
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: { country: string; code: string }) => (
                    <Combobox.Item key={item.code} value={item}>
                      {item.country}
                    </Combobox.Item>
                  )}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByRole('combobox');
      await user.click(screen.getByText('Canada'));
      expect(input).toHaveValue('Canada');
    });

    it('shows the label for a controlled object value not in items', async () => {
      const value = { country: 'Japan', code: 'JP' };

      await render(
        <Combobox.Root
          items={items}
          value={value}
          itemToStringLabel={(item) => item.country}
          itemToStringValue={(item) => item.code}
        >
          <Combobox.Input />
        </Combobox.Root>,
      );

      const input = screen.getByRole('combobox');
      expect(input).toHaveValue('Japan');
    });
  });

  describe('prop: itemToStringValue', () => {
    const items = [
      { country: 'United States', code: 'US' },
      { country: 'Canada', code: 'CA' },
      { country: 'Australia', code: 'AU' },
    ];

    it('uses itemToStringValue for form submission', async () => {
      await render(
        <Combobox.Root
          name="country"
          items={items}
          itemToStringLabel={(item) => item.country}
          itemToStringValue={(item) => item.code}
          defaultValue={items[0]}
        >
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: string) => (
                    <Combobox.Item key={item} value={item}>
                      {item}
                    </Combobox.Item>
                  )}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const hiddenInput = screen.getByDisplayValue('US'); // input[name="country"]
      expect(hiddenInput.tagName).toBe('INPUT');
      expect(hiddenInput).toHaveAttribute('name', 'country');
    });

    it('uses itemToStringValue for multiple selection form submission', async () => {
      const values = [items[0], items[1]];
      await render(
        <Combobox.Root
          name="countries"
          items={items}
          itemToStringLabel={(item) => item.country}
          itemToStringValue={(item) => item.code}
          multiple
          defaultValue={values}
        >
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: string) => (
                    <Combobox.Item key={item} value={item}>
                      {item}
                    </Combobox.Item>
                  )}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      values.forEach((value) => {
        const input = screen.getByDisplayValue(value.code);
        expect(input.tagName).toBe('INPUT');
        expect(input).toHaveAttribute('name', 'countries');
      });
    });
  });

  describe('initial input value derivation', () => {
    it('derives input from defaultValue on first mount when unspecified', async () => {
      await render(
        <Combobox.Root defaultValue="apple">
          <Combobox.Input />
        </Combobox.Root>,
      );

      expect(screen.getByRole('combobox')).toHaveValue('apple');
    });

    it('derives input from defaultValue on first mount with items prop', async () => {
      const items = [{ value: 'apple', label: 'Apple' }];
      await render(
        <Combobox.Root items={items} defaultValue={items[0]}>
          <Combobox.Input />
        </Combobox.Root>,
      );

      expect(screen.getByRole('combobox')).toHaveValue('Apple');
    });

    it('derives input from controlled value on first mount when unspecified', async () => {
      await render(
        <Combobox.Root value="banana">
          <Combobox.Input />
        </Combobox.Root>,
      );

      expect(screen.getByRole('combobox')).toHaveValue('banana');
    });

    it('defaultInputValue overrides derivation when provided', async () => {
      await render(
        <Combobox.Root defaultValue="apple" defaultInputValue="x">
          <Combobox.Input />
        </Combobox.Root>,
      );

      expect(screen.getByRole('combobox')).toHaveValue('x');
    });

    it('inputValue overrides derivation when provided', async () => {
      await render(
        <Combobox.Root value="apple" inputValue="x">
          <Combobox.Input />
        </Combobox.Root>,
      );

      expect(screen.getByRole('combobox')).toHaveValue('x');
    });

    it('multiple mode initial input remains empty', async () => {
      const items = [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
      ];
      await render(
        <Combobox.Root multiple items={items}>
          <Combobox.Input />
        </Combobox.Root>,
      );

      const input = screen.getAllByRole('combobox').find((element) => element.tagName === 'INPUT');

      expect(input).toHaveValue('');
    });

    it('does not set input value for input-inside-popup pattern', async () => {
      await render(
        <Combobox.Root defaultOpen defaultValue="apple">
          <Combobox.Trigger>Trigger</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Input />
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getAllByRole('combobox').find((element) => element.tagName === 'INPUT');

      expect(input).toHaveValue('');
    });
  });

  describe('input value synchronization', () => {
    it('updates derived input when controlled value changes externally', async () => {
      const items = [
        { value: 'apple', label: 'Apple' },
        { value: 'banana', label: 'Banana' },
      ];

      const { setProps } = await render(
        <Combobox.Root items={items} value={items[0]}>
          <Combobox.Input />
        </Combobox.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');
      expect(input).toHaveValue('Apple');

      await setProps({ value: items[1] });

      expect(input).toHaveValue('Banana');
    });

    it('re-derives input when items array changes', async () => {
      const initialItems = [
        { value: 'a', label: 'Apple' },
        { value: 'b', label: 'Banana' },
      ];

      const { setProps } = await render(
        <Combobox.Root items={initialItems} value={initialItems[0]}>
          <Combobox.Input />
        </Combobox.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');
      expect(input).toHaveValue('Apple');

      const nextItems = [
        { value: 'a', label: 'Apricot' },
        { value: 'b', label: 'Banana' },
        { value: 'c', label: 'Cherry' },
      ];

      await setProps({ items: nextItems, value: nextItems[0] });
      expect(input).toHaveValue('Apricot');

      const sameLengthDifferentItems = [
        { value: 'a', label: 'Ambrosia' },
        { value: 'b', label: 'Blue Java' },
        { value: 'c', label: 'Clementine' },
      ];

      await setProps({ items: sameLengthDifferentItems, value: sameLengthDifferentItems[0] });
      expect(input).toHaveValue('Ambrosia');
    });

    it('restores derived input after items load asynchronously', async () => {
      const { setProps } = await render(
        <Combobox.Root items={[]} value="banana">
          <Combobox.Input />
        </Combobox.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');
      expect(input).toHaveValue('banana');

      await setProps({ items: ['apple', 'banana', 'bread'] });

      expect(input).toHaveValue('banana');

      await setProps({ items: ['banana'] });

      expect(input).toHaveValue('banana');
    });
  });

  describe('prop: grid', () => {
    it('sets grid roles when grid is enabled and rows are used', async () => {
      await render(
        <Combobox.Root grid defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Row>
                    <Combobox.Item value="1">1</Combobox.Item>
                    <Combobox.Item value="2">2</Combobox.Item>
                    <Combobox.Item value="3">3</Combobox.Item>
                  </Combobox.Row>
                  <Combobox.Row>
                    <Combobox.Item value="4">4</Combobox.Item>
                    <Combobox.Item value="5">5</Combobox.Item>
                    <Combobox.Item value="6">6</Combobox.Item>
                  </Combobox.Row>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const grid = screen.getByRole('grid');
      expect(grid).not.toBe(null);
      const cells = screen.getAllByRole('gridcell');
      expect(cells).toHaveLength(6);
    });

    it('arrow keys navigate across rows and columns in grid mode', async () => {
      const onItemHighlighted = vi.fn();
      const { user } = await render(
        <Combobox.Root grid onItemHighlighted={onItemHighlighted} defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Row>
                    <Combobox.Item value="1">1</Combobox.Item>
                    <Combobox.Item value="2">2</Combobox.Item>
                    <Combobox.Item value="3">3</Combobox.Item>
                  </Combobox.Row>
                  <Combobox.Row>
                    <Combobox.Item value="4">4</Combobox.Item>
                    <Combobox.Item value="5">5</Combobox.Item>
                    <Combobox.Item value="6">6</Combobox.Item>
                  </Combobox.Row>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('grid')).not.toBe(null));

      await user.keyboard('{ArrowDown}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('1'));

      await user.keyboard('{ArrowRight}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('2'));

      await user.keyboard('{ArrowRight}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('3'));

      await user.keyboard('{ArrowDown}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('6'));

      await user.keyboard('{ArrowLeft}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('5'));

      await user.keyboard('{ArrowUp}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('2'));
    });

    // https://github.com/mui/base-ui/issues/4947
    it('moves the input caret on ArrowLeft when no item is highlighted in grid mode', async () => {
      const onItemHighlighted = vi.fn();
      const { user } = await render(
        <Combobox.Root grid onItemHighlighted={onItemHighlighted} defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Row>
                    <Combobox.Item value="1">1</Combobox.Item>
                    <Combobox.Item value="2">2</Combobox.Item>
                  </Combobox.Row>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByTestId<HTMLInputElement>('input');
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('grid')).not.toBe(null));

      await user.type(input, 'abc');

      expect(input.value).toBe('abc');
      expect(input.selectionStart).toBe(3);

      await user.keyboard('{ArrowLeft}');

      expect(input.selectionStart).toBe(2);
      expect(input.selectionEnd).toBe(2);
      expect(onItemHighlighted).not.toHaveBeenCalled();
    });

    // https://github.com/mui/base-ui/issues/4947
    it('moves the input caret on ArrowRight when no item is highlighted in grid mode', async () => {
      const onItemHighlighted = vi.fn();
      const { user } = await render(
        <Combobox.Root grid onItemHighlighted={onItemHighlighted} defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Row>
                    <Combobox.Item value="1">1</Combobox.Item>
                    <Combobox.Item value="2">2</Combobox.Item>
                  </Combobox.Row>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByTestId<HTMLInputElement>('input');
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('grid')).not.toBe(null));

      await user.type(input, 'abc');
      input.setSelectionRange(1, 1);

      expect(input.selectionStart).toBe(1);

      await user.keyboard('{ArrowRight}');

      expect(input.selectionStart).toBe(2);
      expect(input.selectionEnd).toBe(2);
      expect(onItemHighlighted).not.toHaveBeenCalled();
    });

    // https://github.com/mui/base-ui/issues/4947
    it('keeps grid navigation when autoHighlight surfaces an item before typing arrow keys', async () => {
      const onItemHighlighted = vi.fn();
      const { user } = await render(
        <Combobox.Root grid autoHighlight onItemHighlighted={onItemHighlighted} defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Row>
                    <Combobox.Item value="1">1</Combobox.Item>
                    <Combobox.Item value="2">2</Combobox.Item>
                  </Combobox.Row>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByTestId<HTMLInputElement>('input');
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('grid')).not.toBe(null));

      await user.type(input, 'a');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('1'));

      await user.keyboard('{ArrowRight}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('2'));
    });

    it('mirrors horizontal grid navigation in RTL mode', async () => {
      const onItemHighlighted = vi.fn();
      const { user } = await render(
        <DirectionProvider direction="rtl">
          <Combobox.Root grid onItemHighlighted={onItemHighlighted} defaultOpen>
            <Combobox.Input data-testid="input" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    <Combobox.Row>
                      <Combobox.Item value="1">1</Combobox.Item>
                      <Combobox.Item value="2">2</Combobox.Item>
                      <Combobox.Item value="3">3</Combobox.Item>
                    </Combobox.Row>
                    <Combobox.Row>
                      <Combobox.Item value="4">4</Combobox.Item>
                      <Combobox.Item value="5">5</Combobox.Item>
                      <Combobox.Item value="6">6</Combobox.Item>
                    </Combobox.Row>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        </DirectionProvider>,
      );

      const input = screen.getByTestId('input');
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('grid')).not.toBe(null));

      await user.keyboard('{ArrowDown}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('1'));

      await user.keyboard('{ArrowLeft}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('2'));

      await user.keyboard('{ArrowLeft}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('3'));

      await user.keyboard('{ArrowRight}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('2'));
    });

    it('supports uneven rows navigation', async () => {
      const onItemHighlighted = vi.fn();
      const { user } = await render(
        <Combobox.Root grid onItemHighlighted={onItemHighlighted} defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Row>
                    <Combobox.Item value="1">1</Combobox.Item>
                    <Combobox.Item value="2">2</Combobox.Item>
                    <Combobox.Item value="3">3</Combobox.Item>
                  </Combobox.Row>
                  <Combobox.Row>
                    <Combobox.Item value="4">4</Combobox.Item>
                    <Combobox.Item value="5">5</Combobox.Item>
                  </Combobox.Row>
                  <Combobox.Row>
                    <Combobox.Item value="6">6</Combobox.Item>
                    <Combobox.Item value="7">7</Combobox.Item>
                    <Combobox.Item value="8">8</Combobox.Item>
                    <Combobox.Item value="9">9</Combobox.Item>
                    <Combobox.Item value="10">10</Combobox.Item>
                  </Combobox.Row>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('grid')).not.toBe(null));

      await user.keyboard('{ArrowDown}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('1'));

      await user.keyboard('{ArrowRight}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('2'));

      await user.keyboard('{ArrowRight}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('3'));

      // Down from last col (3) to shorter row should clamp to last item (5)
      await user.keyboard('{ArrowDown}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('5'));

      // Up from clamped item (5) should return to same column in previous row (2)
      await user.keyboard('{ArrowUp}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('2'));

      // From 2, move down to 5 (same column), then down to 7 in the longer row
      await user.keyboard('{ArrowDown}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('5'));

      await user.keyboard('{ArrowDown}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('7'));

      // Left within last row goes to 6, up to first col in previous row (4)
      await user.keyboard('{ArrowLeft}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('6'));

      await user.keyboard('{ArrowUp}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('4'));
    });

    it('supports uneven rows navigation within groups', async () => {
      const onItemHighlighted = vi.fn();
      const { user } = await render(
        <Combobox.Root grid onItemHighlighted={onItemHighlighted} defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Group>
                    <Combobox.Row>
                      <Combobox.Item value="1">1</Combobox.Item>
                      <Combobox.Item value="2">2</Combobox.Item>
                      <Combobox.Item value="3">3</Combobox.Item>
                    </Combobox.Row>
                  </Combobox.Group>
                  <Combobox.Group>
                    <Combobox.Row>
                      <Combobox.Item value="4">4</Combobox.Item>
                      <Combobox.Item value="5">5</Combobox.Item>
                    </Combobox.Row>
                  </Combobox.Group>
                  <Combobox.Group>
                    <Combobox.Row>
                      <Combobox.Item value="6">6</Combobox.Item>
                      <Combobox.Item value="7">7</Combobox.Item>
                      <Combobox.Item value="8">8</Combobox.Item>
                      <Combobox.Item value="9">9</Combobox.Item>
                      <Combobox.Item value="10">10</Combobox.Item>
                    </Combobox.Row>
                  </Combobox.Group>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('grid')).not.toBe(null));

      await user.keyboard('{ArrowDown}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('1'));

      await user.keyboard('{ArrowRight}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('2'));

      await user.keyboard('{ArrowRight}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('3'));

      await user.keyboard('{ArrowDown}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('5'));

      await user.keyboard('{ArrowUp}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('2'));

      await user.keyboard('{ArrowDown}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('5'));

      await user.keyboard('{ArrowDown}');
      await waitFor(() => expect(onItemHighlighted.mock.lastCall?.[0]).toBe('7'));
    });
  });

  describe('prop: multiple', () => {
    it('"single" selects and closes, then reopens with selection focused', async () => {
      const { user } = await render(
        <Combobox.Root defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                  <Combobox.Item value="b">b</Combobox.Item>
                  <Combobox.Item value="c">c</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');
      await user.click(screen.getByRole('option', { name: 'b' }));
      expect(screen.queryByRole('listbox')).toBe(null);
      expect(input).toHaveValue('b');

      await user.click(input);
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));
      expect(screen.getByRole('option', { name: 'b' })).toHaveAttribute('aria-selected', 'true');
    });

    it('"single" keeps the popup open when selection is canceled', async () => {
      const onValueChange = vi.fn((value, details: Combobox.Root.ChangeEventDetails) => {
        details.cancel();
      });
      const { user } = await render(
        <Combobox.Root defaultOpen onValueChange={onValueChange}>
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
      await user.click(screen.getByRole('option', { name: 'b' }));

      // The change was canceled, so the value never committed and the popup stays open.
      expect(onValueChange).toHaveBeenCalled();
      expect(screen.queryByRole('listbox')).not.toBe(null);
      expect(input).not.toHaveValue('b');
    });

    it('"multiple" clears uncontrolled input after select when filtering', async () => {
      const { user } = await render(
        <Combobox.Root multiple>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="apple">apple</Combobox.Item>
                  <Combobox.Item value="banana">banana</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');
      await user.type(input, 'app');
      await flushMicrotasks();
      await user.click(screen.getByRole('option', { name: 'apple' }));
      await flushMicrotasks();

      // After selecting while filtering, uncontrolled input clears
      expect(input).toHaveValue('');
    });

    it('does not close popup when filtering with input inside popup in multiple mode', async () => {
      const items = ['apple', 'apricot', 'banana'];
      const { user } = await render(
        <Combobox.Root multiple items={items}>
          <Combobox.Trigger data-testid="trigger">
            <Combobox.Value />
          </Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Input data-testid="input" />
                <Combobox.List>
                  {(item: string) => (
                    <Combobox.Item key={item} value={item}>
                      {item}
                    </Combobox.Item>
                  )}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      await user.click(trigger);

      const input = await screen.findByTestId('input');
      await user.type(input, 'app');
      await user.click(screen.getByRole('option', { name: 'apple' }));

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBe(null);
      });
      expect(input).toHaveValue('');
    });

    it.skipIf(isJSDOM)(
      'keeps filtered popup content stable while closing with input inside popup',
      async ({ onTestFinished }) => {
        globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

        onTestFinished(() => {
          globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
        });

        const style = `
          @keyframes combobox-close-test {
            to {
              opacity: 0;
            }
          }

          .animation-test-popup[data-ending-style] {
            animation: combobox-close-test 100ms linear;
          }
        `;

        const items = ['apple', 'apricot', 'banana'];
        const { user } = await render(
          <React.Fragment>
            {/* eslint-disable-next-line react/no-danger */}
            <style dangerouslySetInnerHTML={{ __html: style }} />
            <Combobox.Root multiple items={items}>
              <Combobox.Trigger data-testid="trigger">
                <Combobox.Value />
              </Combobox.Trigger>
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup
                    data-testid="popup"
                    className="animation-test-popup"
                    aria-label="Fruits"
                  >
                    <Combobox.Input data-testid="input" />
                    <Combobox.Empty>No matches</Combobox.Empty>
                    <Combobox.List>
                      {(item: string) => (
                        <Combobox.Item key={item} value={item}>
                          {item}
                        </Combobox.Item>
                      )}
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          </React.Fragment>,
        );

        const trigger = screen.getByTestId('trigger');
        await user.click(trigger);

        const input = await screen.findByTestId('input');
        await user.type(input, 'zz');

        await waitFor(() => {
          expect(screen.getByRole('status')).toHaveTextContent('No matches');
        });
        expect(screen.queryByText('apple')).toBe(null);

        await user.keyboard('{Escape}');

        const popup = screen.getByTestId('popup');
        await waitFor(() => {
          expect(popup).toHaveAttribute('data-ending-style');
        });

        expect(screen.getByRole('status')).toHaveTextContent('No matches');
        expect(screen.queryByText('apple')).toBe(null);

        await waitFor(() => {
          expect(screen.queryByTestId('popup')).toBe(null);
        });

        await user.click(trigger);

        const reopenedInput = await screen.findByTestId('input');
        expect(reopenedInput).toHaveValue('');
        expect(screen.getByText('apple')).not.toBe(null);
      },
    );

    it.skipIf(isJSDOM)(
      'clears the deferred popup input when reopening during close animation',
      async ({ onTestFinished }) => {
        globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

        onTestFinished(() => {
          globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
        });

        const style = `
          @keyframes combobox-close-test {
            to {
              opacity: 0;
            }
          }

          .animation-test-popup[data-ending-style] {
            animation: combobox-close-test 100ms linear;
          }
        `;

        const items = ['apple', 'apricot', 'banana'];
        const { user } = await render(
          <React.Fragment>
            {/* eslint-disable-next-line react/no-danger */}
            <style dangerouslySetInnerHTML={{ __html: style }} />
            <Combobox.Root multiple items={items}>
              <Combobox.Trigger data-testid="trigger">
                <Combobox.Value />
              </Combobox.Trigger>
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup
                    data-testid="popup"
                    className="animation-test-popup"
                    aria-label="Fruits"
                  >
                    <Combobox.Input data-testid="input" />
                    <Combobox.Empty>No matches</Combobox.Empty>
                    <Combobox.List>
                      {(item: string) => (
                        <Combobox.Item key={item} value={item}>
                          {item}
                        </Combobox.Item>
                      )}
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          </React.Fragment>,
        );

        const trigger = screen.getByTestId('trigger');
        await user.click(trigger);

        const input = await screen.findByTestId('input');
        await user.type(input, 'zz');

        await waitFor(() => {
          expect(screen.getByRole('status')).toHaveTextContent('No matches');
        });

        await user.keyboard('{Escape}');

        const popup = screen.getByTestId('popup');
        await waitFor(() => {
          expect(popup).toHaveAttribute('data-ending-style');
        });

        await user.click(trigger);

        await waitFor(() => {
          expect(popup).not.toHaveAttribute('data-ending-style');
        });

        expect(screen.getByTestId('input')).toHaveValue('');
        expect(screen.getByText('apple')).not.toBe(null);
        expect(screen.getByText('banana')).not.toBe(null);
      },
    );

    it('"multiple" clears typed input on close when no selection made', async () => {
      const onInput = vi.fn();
      const { user } = await render(
        <Combobox.Root multiple defaultOpen onInputValueChange={onInput}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="apple">apple</Combobox.Item>
                  <Combobox.Item value="banana">banana</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');
      await user.type(input, 'app');
      await flushMicrotasks();

      // Close without selecting
      await user.keyboard('{Escape}');

      expect(screen.queryByRole('listbox')).toBe(null);
      expect(input).toHaveValue('');
      expect(onInput.mock.lastCall?.[0]).toBe('');
      expect(onInput.mock.lastCall?.[1].reason).toBe(REASONS.inputClear);
    });

    it('does not clear popup input after canceled multiple value changes', async () => {
      const onInputValueChange = vi.fn();
      const onValueChange = vi.fn((value, details: Combobox.Root.ChangeEventDetails) => {
        details.cancel();
      });

      const { user } = await render(
        <Combobox.Root
          multiple
          onInputValueChange={onInputValueChange}
          onValueChange={onValueChange}
        >
          <Combobox.Trigger>Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Input data-testid="input" />
                <Combobox.List>
                  <Combobox.Item value="apple">apple</Combobox.Item>
                  <Combobox.Item value="apricot">apricot</Combobox.Item>
                  <Combobox.Item value="banana">banana</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      await user.click(screen.getByText('Open'));

      const input = await screen.findByTestId('input');
      // Wait for the popup to finish opening so the input is interactive (the positioner is
      // `inert` until then).
      await screen.findByRole('option', { name: 'apple' });
      await user.type(input, 'app');
      onInputValueChange.mockClear();

      await user.click(screen.getByRole('option', { name: 'apple' }));

      expect(onValueChange).toHaveBeenCalled();
      expect(input).toHaveValue('app');
      expect(onInputValueChange).not.toHaveBeenCalled();
    });

    it('"single" clears typed input on close when no selection made (input outside popup)', async () => {
      const onInput = vi.fn();
      const { user } = await render(
        <Combobox.Root defaultOpen onInputValueChange={onInput}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="apple">apple</Combobox.Item>
                  <Combobox.Item value="banana">banana</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');
      await user.type(input, 'zz');
      await flushMicrotasks();

      // Close without selecting
      await user.keyboard('{Escape}');

      await waitFor(() => expect(screen.queryByRole('listbox')).toBe(null));
      expect(input).toHaveValue('');
      expect(onInput.mock.lastCall?.[0]).toBe('');
      expect(onInput.mock.lastCall?.[1].reason).toBe(REASONS.inputClear);
    });
  });

  describe('prop: filter', () => {
    it('uses custom filter to narrow results', async () => {
      const items = ['alpha', 'beta', 'alphabet', 'alpine'];
      const startsWith = (item: string, q: string) => item.toLowerCase().startsWith(q);

      const { user } = await render(
        <Combobox.Root items={items} filter={(item, q) => startsWith(String(item), q)}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item) => (
                    <Combobox.Item key={item} value={item}>
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
      await user.type(input, 'alp');
      await flushMicrotasks();

      // Only beta should be filtered out
      expect(screen.queryByText('beta')).toBe(null);
      expect(screen.queryByText('alpha')).not.toBe(null);
      expect(screen.queryByText('alphabet')).not.toBe(null);
      expect(screen.queryByText('alpine')).not.toBe(null);
    });

    it('resets filtered results after selecting when using a custom search stringifier', async () => {
      type Movie = { id: number; english: string; romaji: string };
      const movies: Movie[] = [
        { id: 1, english: 'Spirited Away', romaji: 'Sen to Chihiro no Kamikakushi' },
        { id: 2, english: 'My Neighbor Totoro', romaji: 'Tonari no Totoro' },
        { id: 3, english: 'Princess Mononoke', romaji: 'Mononoke Hime' },
      ];

      const stringifyMovie = (movie: Movie | null) =>
        movie ? `${movie.english} ${movie.romaji}` : '';

      function MultilingualFilterCombobox() {
        const [value, setValue] = React.useState<Movie | null>(null);
        const { contains } = Combobox.useFilter({ value });

        const filter = React.useCallback(
          (item: Movie | null, query: string) => {
            if (!item) {
              return false;
            }
            return contains(item, query, stringifyMovie);
          },
          [contains],
        );

        return (
          <Combobox.Root
            items={movies}
            value={value}
            onValueChange={setValue}
            filter={filter}
            itemToStringLabel={(movie) => movie?.english ?? ''}
          >
            <Combobox.Input data-testid="input" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    {(movie: Movie) => (
                      <Combobox.Item key={movie.id} value={movie}>
                        {movie.english}
                      </Combobox.Item>
                    )}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        );
      }

      const { user } = await render(<MultilingualFilterCombobox />);
      const input = screen.getByRole('combobox');

      await user.click(input);
      await screen.findByRole('listbox');

      await user.type(input, 'tonari');

      await waitFor(() => {
        expect(screen.queryByRole('option', { name: 'Spirited Away' })).toBe(null);
      });

      await user.click(screen.getByRole('option', { name: 'My Neighbor Totoro' }));

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBe(null);
      });

      await user.click(input);
      await screen.findByRole('listbox');

      await waitFor(() => {
        expect(screen.queryByRole('option', { name: 'Spirited Away' })).not.toBe(null);
      });
    });
  });

  describe('prop: filteredItems', () => {
    it('resets external filteredItems when reopening after a selection', async () => {
      interface TestItem {
        id: number;
        label: string;
        label2: string;
      }

      const testItems: TestItem[] = [
        {
          id: 1,
          label: 'apple',
          label2: 'one',
        },
        {
          id: 2,
          label: 'orange',
          label2: 'two',
        },
        {
          id: 3,
          label: 'banana',
          label2: 'three',
        },
      ];

      function getItemLabelToFilter(item: TestItem | null) {
        return item ? `${item.label} ${item.label2}` : '';
      }

      function getItemLabelToDisplay(item: TestItem | null) {
        return item ? item.label || item.label2 : '';
      }

      function FilteredItemsCombobox() {
        const [searchValue, setSearchValue] = React.useState('');
        const [value, setValue] = React.useState<TestItem | null>(null);

        const deferredSearchValue = React.useDeferredValue(searchValue);

        const { contains } = Combobox.useFilter({ value });

        const resolvedSearchValue =
          searchValue === '' || deferredSearchValue === '' ? searchValue : deferredSearchValue;

        const filteredItems = React.useMemo(() => {
          return testItems.filter((item) =>
            contains(item, resolvedSearchValue, getItemLabelToFilter),
          );
        }, [contains, resolvedSearchValue]);

        return (
          <Combobox.Root
            items={testItems}
            filteredItems={filteredItems}
            inputValue={searchValue}
            onInputValueChange={setSearchValue}
            value={value}
            onValueChange={setValue}
            itemToStringLabel={getItemLabelToDisplay}
            isItemEqualToValue={(item, v) => item?.id === v?.id}
          >
            <Combobox.Input />
            <Combobox.Portal>
              <Combobox.Positioner sideOffset={4}>
                <Combobox.Popup>
                  <Combobox.Empty>No items found.</Combobox.Empty>
                  <Combobox.List>
                    {(item: TestItem) => (
                      <Combobox.Item key={item.id} value={item}>
                        <Combobox.ItemIndicator></Combobox.ItemIndicator>
                        {item.label}
                      </Combobox.Item>
                    )}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        );
      }

      const { user } = await render(<FilteredItemsCombobox />);
      const input = screen.getByRole('combobox');

      await user.click(input);
      await user.type(input, 'one');

      await waitFor(() => {
        expect(screen.queryByRole('option', { name: 'orange' })).toBe(null);
      });

      await user.click(screen.getByRole('option', { name: 'apple' }));

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBe(null);
      });

      await user.click(input);

      await waitFor(() => {
        expect(screen.queryByRole('option', { name: 'orange' })).not.toBe(null);
      });
    });

    it('uses filteredItems when items prop is omitted', async () => {
      const fruits = ['Apple', 'Banana', 'Cherry'];

      function FilteredItemsOnlyCombobox() {
        const [value, setValue] = React.useState<string | null>(null);

        return (
          <Combobox.Root filteredItems={fruits} value={value} onValueChange={setValue}>
            <Combobox.Input data-testid="input" />
            <Combobox.Portal>
              <Combobox.Positioner sideOffset={4}>
                <Combobox.Popup>
                  <Combobox.List>
                    {(item: string) => (
                      <Combobox.Item key={item} value={item}>
                        {item}
                      </Combobox.Item>
                    )}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        );
      }

      const { user } = await render(<FilteredItemsOnlyCombobox />);
      const input = screen.getByTestId('input');

      await user.click(input);
      await screen.findByRole('listbox');
      await user.click(screen.getByRole('option', { name: 'Apple' }));

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBe(null);
      });

      await user.click(input);
      await screen.findByRole('listbox');

      await waitFor(() => {
        expect(screen.queryByRole('option', { name: 'Banana' })).not.toBe(null);
      });
    });

    it('highlights the externally filtered item order when filtering reorders items', async () => {
      const fruits = ['Apple', 'Banana', 'Zucchini'];
      const onItemHighlighted = vi.fn();

      function ReorderingFilteredItemsCombobox() {
        const [input, setInput] = React.useState('');
        const filteredItems = React.useMemo(() => {
          if (input.length > 0) {
            return [...fruits].reverse();
          }
          return fruits;
        }, [input]);

        return (
          <Combobox.Root
            autoHighlight
            filteredItems={filteredItems}
            inputValue={input}
            onInputValueChange={setInput}
            onItemHighlighted={onItemHighlighted}
          >
            <Combobox.Input data-testid="input" />
            <Combobox.Portal>
              <Combobox.Positioner sideOffset={4}>
                <Combobox.Popup>
                  <Combobox.List>
                    {(item: string) => (
                      <Combobox.Item key={item} value={item}>
                        {item}
                      </Combobox.Item>
                    )}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        );
      }

      const { user } = await render(<ReorderingFilteredItemsCombobox />);
      const input = screen.getByTestId('input');

      await user.click(input);
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));

      onItemHighlighted.mockClear();

      await user.type(input, 'a');

      await waitFor(() => {
        expect(onItemHighlighted.mock.calls.length).toBeGreaterThan(0);
      });

      const [highlightedValue] = onItemHighlighted.mock.lastCall ?? [];
      expect(highlightedValue).toBe('Zucchini');
    });
  });

  describe('prop: openOnInputClick', () => {
    it('opens on input click by default', async () => {
      const { user } = await render(
        <Combobox.Root>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));

      // Click input again should not toggle closed automatically
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));
    });

    it('does not open on input click when false, but opens on typing', async () => {
      const { user } = await render(
        <Combobox.Root openOnInputClick={false}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');
      await user.click(input);
      expect(screen.queryByRole('listbox')).toBe(null);

      await user.type(input, 'a');
      expect(screen.queryByRole('listbox')).not.toBe(null);
    });
  });

  describe('prop: autoHighlight', () => {
    it('does not auto-highlight on initial open when no selection', async () => {
      await render(
        <Combobox.Root items={['apple', 'banana', 'cherry']} autoHighlight defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: string) => (
                    <Combobox.Item key={item} value={item}>
                      {item}
                    </Combobox.Item>
                  )}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');
      expect(screen.getByRole('listbox')).not.toBe(null);
      expect(input).not.toHaveAttribute('aria-activedescendant');
    });

    it('shows the selected item as selected on initial open (no active highlight)', async () => {
      await render(
        <Combobox.Root
          items={['apple', 'banana', 'cherry']}
          defaultValue="banana"
          autoHighlight
          defaultOpen
        >
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: string) => (
                    <Combobox.Item key={item} value={item}>
                      {item}
                    </Combobox.Item>
                  )}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');
      const banana = screen.getByRole('option', { name: 'banana' });

      expect(banana).toHaveAttribute('aria-selected', 'true');
      // Highlight is applied only after filtering begins
      expect(input).not.toHaveAttribute('aria-activedescendant');
    });

    it('highlights the first matching item after typing (single mode)', async () => {
      const { user } = await render(
        <Combobox.Root items={['apple', 'banana', 'cherry']} autoHighlight>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: string) => (
                    <Combobox.Item key={item} value={item}>
                      {item}
                    </Combobox.Item>
                  )}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');
      await user.type(input, 'ch');

      const cherry = await screen.findByRole('option', { name: 'cherry' });
      expect(input).toHaveAttribute('aria-activedescendant', cherry.id);
    });

    it('highlights the first matching item after IME composition', async () => {
      await render(
        <Combobox.Root items={['apple', 'banana', 'cherry']} autoHighlight openOnInputClick={false}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: string) => (
                    <Combobox.Item key={item} value={item}>
                      {item}
                    </Combobox.Item>
                  )}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');
      fireEvent.compositionStart(input);
      fireEvent.change(input, { target: { value: 'ch' } });
      fireEvent.compositionEnd(input, { data: 'ch' });

      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));
      const cherry = await screen.findByRole('option', { name: 'cherry' });
      await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant', cherry.id));
    });

    it('highlights the first matching item for a static list without the items prop', async () => {
      const { user } = await render(
        <Combobox.Root autoHighlight>
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="alpha">alpha</Combobox.Item>
                  <Combobox.Item value="alphabet">alphabet</Combobox.Item>
                  <Combobox.Item value="beta">beta</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByRole('combobox');
      await user.type(input, 'al');

      const alpha = screen.getByRole('option', { name: 'alpha' });
      await waitFor(() => expect(alpha).toHaveAttribute('data-highlighted'));
      expect(input).toHaveAttribute('aria-activedescendant', alpha.id);

      await user.type(input, ' ');
      expect(alpha).toHaveAttribute('data-highlighted');
      expect(input).toHaveAttribute('aria-activedescendant', alpha.id);
    });

    it('keeps gridcell typeahead active across Space in row mode without selecting', async () => {
      const onValueChange = vi.fn();
      const { user } = await render(
        <Combobox.Root autoHighlight grid onValueChange={onValueChange}>
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Row>
                    <Combobox.Item value="new-york">new york</Combobox.Item>
                    <Combobox.Item value="new-jersey">new jersey</Combobox.Item>
                  </Combobox.Row>
                  <Combobox.Row>
                    <Combobox.Item value="old-town">old town</Combobox.Item>
                    <Combobox.Item value="other">other</Combobox.Item>
                  </Combobox.Row>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByRole('combobox');
      await user.type(input, 'new');

      const newYork = screen.getByRole('gridcell', { name: 'new york' });
      await waitFor(() => expect(newYork).toHaveAttribute('data-highlighted'));
      expect(input).toHaveAttribute('aria-activedescendant', newYork.id);

      await user.type(input, ' ');
      expect(newYork).toHaveAttribute('data-highlighted');
      expect(input).toHaveAttribute('aria-activedescendant', newYork.id);
      expect(input).toHaveValue('new ');
      expect(onValueChange.mock.calls.length > 0).toBe(false);
    });

    it('does not run follow-up state changes after canceled input value changes', async () => {
      const onValueChange = vi.fn();
      const onOpenChange = vi.fn();
      const onInputValueChange = vi.fn((value, details: Combobox.Root.ChangeEventDetails) => {
        details.cancel();
      });

      const { user } = await render(
        <Combobox.Root
          defaultValue="apple"
          openOnInputClick={false}
          onInputValueChange={onInputValueChange}
          onOpenChange={onOpenChange}
          onValueChange={onValueChange}
        >
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="apple">apple</Combobox.Item>
                  <Combobox.Item value="banana">banana</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByRole('combobox');

      await user.clear(input);

      expect(onInputValueChange).toHaveBeenCalled();
      expect(onValueChange).not.toHaveBeenCalled();
      expect(onOpenChange).not.toHaveBeenCalled();
      expect(screen.queryByRole('listbox')).toBe(null);

      onInputValueChange.mockClear();
      onOpenChange.mockClear();

      await user.type(input, 'b');

      expect(onInputValueChange).toHaveBeenCalled();
      expect(onOpenChange).not.toHaveBeenCalled();
      expect(screen.queryByRole('listbox')).toBe(null);
    });

    it('retains highlight when query is cleared back to empty', async () => {
      const { user } = await render(
        <Combobox.Root items={['apple', 'banana', 'cherry']} autoHighlight>
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: string) => (
                    <Combobox.Item key={item} value={item}>
                      {item}
                    </Combobox.Item>
                  )}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');

      await user.type(input, 'a');
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBe(null);
      });
      await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant'));

      await user.clear(input);
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));
      await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant'));
    });

    it('retains highlight when clearing the query with input-change behavior', async () => {
      const { user } = await render(
        <Combobox.Root items={['apple', 'banana', 'cherry']} autoHighlight>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: string) => (
                    <Combobox.Item key={item} value={item}>
                      {item}
                    </Combobox.Item>
                  )}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));

      await user.type(input, 'ban');
      await screen.findByRole('option', { name: 'banana' });
      await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant'));
      const highlightedBefore = input.getAttribute('aria-activedescendant');
      expect(highlightedBefore).not.toBe(null);

      await user.clear(input);
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));
      await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant'));
    });

    it('highlights the first matching item after typing (multiple mode)', async () => {
      const { user } = await render(
        <Combobox.Root items={['apple', 'banana', 'cherry']} multiple autoHighlight>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: string) => (
                    <Combobox.Item key={item} value={item}>
                      {item}
                    </Combobox.Item>
                  )}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');

      await user.type(input, 'ba');
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBe(null);
      });

      const activeId = input.getAttribute('aria-activedescendant');
      expect(activeId).not.toBe(null);
      const activeEl = document.getElementById(activeId!);
      expect(activeEl?.textContent).toBe('banana');
    });

    it('clears highlight after removing the highlighted chip while filtering (multiple mode)', async () => {
      const { user } = await render(
        <Combobox.Root
          items={['apple', 'banana', 'cherry']}
          multiple
          autoHighlight
          defaultOpen
          defaultValue={['apple']}
        >
          <Combobox.Chips>
            <Combobox.Value>
              {(value: string[]) => (
                <React.Fragment>
                  {value.map((item) => (
                    <Combobox.Chip key={item}>
                      {item}
                      <Combobox.ChipRemove aria-label={`Remove ${item}`} />
                    </Combobox.Chip>
                  ))}
                  <Combobox.Input data-testid="input" />
                </React.Fragment>
              )}
            </Combobox.Value>
          </Combobox.Chips>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: string) => (
                    <Combobox.Item key={item} value={item}>
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

      await waitFor(() => {
        expect(screen.getByRole('listbox')).not.toBe(null);
      });

      await user.type(input, 'a');
      await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant'));

      await user.click(screen.getByRole('button', { name: 'Remove apple', hidden: true }));

      await waitFor(() => expect(input.getAttribute('aria-activedescendant')).toBe(null));
    });

    it('keeps the active item highlighted after clearing the last selected value', async () => {
      const items = [
        { id: 'js', value: 'JavaScript' },
        { id: 'ts', value: 'TypeScript' },
        { id: 'py', value: 'Python' },
        { id: 'rb', value: 'Ruby' },
      ];

      const { user } = await render(
        <Combobox.Root items={items} multiple>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: (typeof items)[number]) => (
                    <Combobox.Item key={item.id} value={item}>
                      {item.value}
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

      await user.click(screen.getByRole('option', { name: 'JavaScript' }));
      await user.click(screen.getByRole('option', { name: 'TypeScript' }));

      await user.type(input, 'pyth');
      await user.click(screen.getByRole('option', { name: 'Python' }));

      await waitFor(() => expect(screen.queryByRole('listbox')).toBe(null));

      input.focus();
      await user.keyboard('{ArrowDown}');
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));

      await user.hover(screen.getByRole('option', { name: 'JavaScript' }));
      await user.click(screen.getByRole('option', { name: 'JavaScript' }));
      await user.hover(screen.getByRole('option', { name: 'TypeScript' }));
      await user.click(screen.getByRole('option', { name: 'TypeScript' }));

      const pythonOption = screen.getByRole('option', { name: 'Python' });
      await user.hover(pythonOption);
      await user.click(pythonOption);

      await waitFor(() => {
        expect(input).toHaveAttribute('aria-activedescendant', pythonOption.id);
      });

      await user.keyboard('{ArrowDown}');
      const rubyOption = screen.getByRole('option', { name: 'Ruby' });
      await waitFor(() => {
        expect(input).toHaveAttribute('aria-activedescendant', rubyOption.id);
      });
    });

    it('does not shift highlight to the previous selected item on Enter deselect', async () => {
      const items = [
        { id: 'js', value: 'JavaScript' },
        { id: 'ts', value: 'TypeScript' },
        { id: 'py', value: 'Python' },
      ];

      const { user } = await render(
        <Combobox.Root items={items} multiple defaultValue={[items[0], items[1]]}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: (typeof items)[number]) => (
                    <Combobox.Item key={item.id} value={item}>
                      {item.value}
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

      const typeScriptOption = screen.getByRole('option', { name: 'TypeScript' });
      await user.hover(typeScriptOption);
      await waitFor(() => {
        expect(input).toHaveAttribute('aria-activedescendant', typeScriptOption.id);
      });

      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(typeScriptOption).toHaveAttribute('aria-selected', 'false');
        expect(input).toHaveAttribute('aria-activedescendant', typeScriptOption.id);
      });
    });

    it('continues ArrowDown navigation from the Enter-selected item (multiple mode)', async () => {
      const items = [
        { id: 'js', value: 'JavaScript' },
        { id: 'ts', value: 'TypeScript' },
        { id: 'py', value: 'Python' },
      ];

      const { user } = await render(
        <Combobox.Root items={items} multiple>
          <Combobox.Chips>
            <Combobox.Value>
              {(value: (typeof items)[number][]) => (
                <React.Fragment>
                  {value.map((item) => (
                    <Combobox.Chip key={item.id} aria-label={item.value}>
                      {item.value}
                      <Combobox.ChipRemove aria-label={`Remove ${item.value}`} />
                    </Combobox.Chip>
                  ))}
                  <Combobox.Input data-testid="input" />
                </React.Fragment>
              )}
            </Combobox.Value>
          </Combobox.Chips>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: (typeof items)[number]) => (
                    <Combobox.Item key={item.id} value={item}>
                      {item.value}
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

      const typeScriptOption = screen.getByRole('option', { name: 'TypeScript' });
      await user.hover(typeScriptOption);
      await waitFor(() => {
        expect(input).toHaveAttribute('aria-activedescendant', typeScriptOption.id);
      });

      await user.keyboard('{Enter}');
      await waitFor(() => {
        expect(input).toHaveAttribute('aria-activedescendant', typeScriptOption.id);
      });

      await user.keyboard('{ArrowDown}');

      const pythonOption = screen.getByRole('option', { name: 'Python' });
      await waitFor(() => {
        expect(input).toHaveAttribute('aria-activedescendant', pythonOption.id);
      });
    });

    it('clears active highlight when removing the highlighted chip item', async () => {
      const items = [
        { id: 'js', value: 'JavaScript' },
        { id: 'ts', value: 'TypeScript' },
        { id: 'py', value: 'Python' },
      ];

      const { user } = await render(
        <Combobox.Root items={items} multiple defaultValue={[items[0], items[1]]}>
          <Combobox.Chips>
            <Combobox.Value>
              {(value: (typeof items)[number][]) => (
                <React.Fragment>
                  {value.map((item) => (
                    <Combobox.Chip key={item.id} aria-label={item.value}>
                      {item.value}
                      <Combobox.ChipRemove aria-label={`Remove ${item.value}`} />
                    </Combobox.Chip>
                  ))}
                  <Combobox.Input data-testid="input" />
                </React.Fragment>
              )}
            </Combobox.Value>
          </Combobox.Chips>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: (typeof items)[number]) => (
                    <Combobox.Item key={item.id} value={item}>
                      {item.value}
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

      await user.keyboard('{ArrowUp}');

      await waitFor(() => {
        expect(input).toHaveAttribute('aria-activedescendant');
      });

      const highlightedOption = document.getElementById(
        input.getAttribute('aria-activedescendant')!,
      );
      const highlightedLabel = highlightedOption?.textContent;
      expect(highlightedLabel).not.toBe(null);

      await user.click(
        screen.getByRole('button', { name: `Remove ${highlightedLabel as string}`, hidden: true }),
      );

      await waitFor(() => {
        expect(input.getAttribute('aria-activedescendant')).toBe(null);
      });
    });

    it('keeps highlight in sync after selecting then backspacing to a single match', async () => {
      const items = ['alpha', 'beta', 'gamma', 'delta', 'epsilon'];
      const { user } = await render(
        <Combobox.Root items={items} autoHighlight>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: string) => (
                    <Combobox.Item key={item} value={item}>
                      {item}
                    </Combobox.Item>
                  )}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));

      // Select index 4
      await user.click(screen.getByRole('option', { name: 'epsilon' }));
      await waitFor(() => expect(screen.queryByRole('listbox')).toBe(null));

      // Reopen and press Backspace to narrow to a single match
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));

      // Backspace once: from 'epsilon' -> 'epsilo', which should still only match 'epsilon'
      await user.keyboard('{Backspace}');
      const epsilon = await screen.findByRole('option', { name: 'epsilon' });
      // With autoHighlight, the first (and only) item should be highlighted
      await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant', epsilon.id));
    });

    it('navigates on first ArrowDown after editing selection to a new matching query', async () => {
      const { user } = await render(
        <Combobox.Root items={['Apple', 'Grape', 'Grapefruit']} autoHighlight>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: string) => (
                    <Combobox.Item key={item} value={item}>
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

      // Open and select Apple
      await user.click(input);
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));
      await user.click(screen.getByRole('option', { name: 'Apple' }));

      // Edit input to "Ape" (matches Grape and Grapefruit)
      await user.click(input);
      await user.clear(input);
      await user.type(input, 'Ape');
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));

      const grape = screen.getByRole('option', { name: 'Grape' });
      const grapefruit = screen.getByRole('option', { name: 'Grapefruit' });

      // With autoHighlight, first match is highlighted immediately
      await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant', grape.id));

      // One ArrowDown should move to the next match (no double keypress needed)
      await user.keyboard('{ArrowDown}');
      await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant', grapefruit.id));
    });

    it('updates highlighted callback with newly filtered first item', async () => {
      const onItemHighlighted = vi.fn();
      const items = ['banana', 'apple', 'apricot'];

      const { user } = await render(
        <Combobox.Root
          items={items}
          autoHighlight
          defaultOpen
          onItemHighlighted={onItemHighlighted}
        >
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: string) => (
                    <Combobox.Item key={item} value={item}>
                      {item}
                    </Combobox.Item>
                  )}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByRole('combobox');

      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));
      await user.click(input);
      await user.keyboard('{ArrowDown}');

      await waitFor(() => {
        expect(onItemHighlighted.mock.calls.length).toBeGreaterThan(0);
      });
      const [initialValue] = onItemHighlighted.mock.lastCall ?? [];
      expect(initialValue).toBe('banana');

      onItemHighlighted.mockClear();

      await user.type(input, 'ap');

      await waitFor(() => {
        expect(onItemHighlighted.mock.calls.length).toBeGreaterThan(0);
      });
      const [nextValue, data] = onItemHighlighted.mock.lastCall ?? [];
      expect(nextValue).toBe('apple');
      expect(data.reason).toBe('none');
      expect(data.index).toBe(0);
    });

    it('fires a single clearing highlight on Enter selection', async () => {
      const onItemHighlighted = vi.fn();

      const { user } = await render(
        <Combobox.Root
          items={['Apple', 'Apricot', 'Banana']}
          autoHighlight
          onItemHighlighted={onItemHighlighted}
        >
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: string) => (
                    <Combobox.Item key={item} value={item}>
                      {item}
                    </Combobox.Item>
                  )}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByRole('combobox');

      await user.click(input);
      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));
      await user.type(input, 'app');

      // Reset history to focus on close events only.
      onItemHighlighted.mockClear();
      await user.keyboard('{Enter}');
      await flushMicrotasks();

      const clearingCalls = onItemHighlighted.mock.calls.filter((call) => call[0] === undefined);
      expect(clearingCalls.length).toBe(1);
      const postClearCalls = onItemHighlighted.mock.calls.slice(
        onItemHighlighted.mock.calls.indexOf(clearingCalls[0]) + 1,
      );
      expect(postClearCalls.every((c) => c[0] === undefined)).toBe(true);
    });
  });

  describe('prop: onItemHighlighted', () => {
    it('fires on keyboard navigation', async () => {
      const items = ['a', 'b', 'c'];
      const onItemHighlighted = vi.fn();

      const { user } = await render(
        <Combobox.Root items={items} onItemHighlighted={onItemHighlighted}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: string) => (
                    <Combobox.Item key={item} value={item}>
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

      await waitFor(() => {
        expect(onItemHighlighted.mock.calls.length).toBeGreaterThan(0);
      });
      const [value, eventDetails] = onItemHighlighted.mock.lastCall ?? [];
      expect(value).toBe('a');
      expect(eventDetails.reason).toBe('keyboard');
      expect(eventDetails.index).toBe(0);
    });
  });

  describe('prop: open', () => {
    it('controls the open state', async () => {
      const { setProps, user } = await render(
        <Combobox.Root open={false}>
          <Combobox.Input />
          <Combobox.Trigger>Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByRole('combobox');

      await user.click(input);
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBe(null);
      });

      await setProps({ open: true });
      await waitFor(() => {
        expect(screen.getByRole('listbox')).not.toBe(null);
      });

      await user.click(document.body);
      await waitFor(() => {
        expect(screen.getByRole('listbox')).not.toBe(null);
      });
    });

    it('keeps filtering responsive after selection when inline and open is controlled', async () => {
      const items = ['Apple', 'Apricot', 'Banana', 'Grape', 'Orange'];

      const { user } = await render(
        <Combobox.Root items={items} open inline>
          <Combobox.Input data-testid="input" />
          <Combobox.List>
            {(item: string) => (
              <Combobox.Item key={item} value={item}>
                {item}
              </Combobox.Item>
            )}
          </Combobox.List>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');

      await user.type(input, 'ap');

      await waitFor(() => {
        expect(screen.queryByRole('option', { name: 'Banana' })).toBe(null);
      });

      await user.click(screen.getByRole('option', { name: 'Apple' }));

      await user.clear(input);
      await user.type(input, 'ba');

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Banana' })).not.toBe(null);
      });
    });
  });

  describe('prop: onOpenChange', () => {
    it('fires when opening and closing', async () => {
      const onOpenChange = vi.fn();

      const { user } = await render(
        <Combobox.Root onOpenChange={onOpenChange}>
          <Combobox.Input />
          <Combobox.Trigger>Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByRole('combobox');

      await user.click(input);
      await waitFor(() => {
        expect(onOpenChange.mock.calls.length).toBeGreaterThan(0);
      });
      expect(onOpenChange.mock.lastCall?.[0]).toBe(true);

      // Close by clicking outside
      await user.click(document.body);
      await waitFor(() => {
        expect(onOpenChange.mock.lastCall?.[0]).toBe(false);
      });
    });
  });

  describe('prop: defaultOpen', () => {
    it('opens by default', async () => {
      await render(
        <Combobox.Root defaultOpen>
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      expect(screen.getByRole('listbox')).not.toBe(null);
    });

    it('remains uncontrolled (can be closed via interaction)', async () => {
      const { user } = await render(
        <Combobox.Root defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Trigger>Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      expect(screen.getByRole('listbox')).not.toBe(null);

      await user.click(document.body);

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBe(null);
      });
    });

    it('is overridden by controlled open={false}', async () => {
      await render(
        <Combobox.Root defaultOpen open={false}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      expect(screen.queryByRole('listbox')).toBe(null);
    });

    it('respects controlled open={true}', async () => {
      await render(
        <Combobox.Root defaultOpen open>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      expect(screen.getByRole('listbox')).not.toBe(null);
    });
  });

  describe('prop: limit', () => {
    it('limits the number of items displayed when no groups are used', async () => {
      const items = ['apple', 'banana', 'cherry', 'date', 'elderberry'];
      await render(
        <Combobox.Root items={items} limit={3} defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item) => (
                    <Combobox.Item key={item} value={item}>
                      {item}
                    </Combobox.Item>
                  )}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      // Should only show the first 3 items
      expect(screen.getByRole('option', { name: 'apple' })).not.toBe(null);
      expect(screen.getByRole('option', { name: 'banana' })).not.toBe(null);
      expect(screen.getByRole('option', { name: 'cherry' })).not.toBe(null);
      expect(screen.queryByRole('option', { name: 'date' })).toBe(null);
      expect(screen.queryByRole('option', { name: 'elderberry' })).toBe(null);
    });

    it('limits the number of items displayed when groups are used', async () => {
      const items = [
        {
          value: 'citrus',
          items: ['orange', 'lemon', 'lime'],
        },
        {
          value: 'berries',
          items: ['strawberry', 'blueberry', 'raspberry'],
        },
      ];

      await render(
        <Combobox.Root items={items} limit={4} defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(group) => (
                    <Combobox.Group key={group.value} items={group.items}>
                      <Combobox.GroupLabel>{group.value}</Combobox.GroupLabel>
                      <Combobox.Collection>
                        {(item) => (
                          <Combobox.Item key={item} value={item}>
                            {item}
                          </Combobox.Item>
                        )}
                      </Combobox.Collection>
                    </Combobox.Group>
                  )}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      // Should show first 4 items across groups
      expect(screen.getByRole('option', { name: 'orange' })).not.toBe(null);
      expect(screen.getByRole('option', { name: 'lemon' })).not.toBe(null);
      expect(screen.getByRole('option', { name: 'lime' })).not.toBe(null);
      expect(screen.getByRole('option', { name: 'strawberry' })).not.toBe(null);
      // These should be limited out
      expect(screen.queryByRole('option', { name: 'blueberry' })).toBe(null);
      expect(screen.queryByRole('option', { name: 'raspberry' })).toBe(null);

      // Group labels should still be visible
      expect(screen.getByText('citrus')).not.toBe(null);
      expect(screen.getByText('berries')).not.toBe(null);
    });

    it('respects limit when filtering items', async () => {
      const items = ['apple', 'apricot', 'avocado', 'banana', 'blueberry'];
      const { user } = await render(
        <Combobox.Root items={items} limit={2} defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item) => (
                    <Combobox.Item key={item} value={item}>
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

      // Type 'a' to filter items starting with 'a'
      await user.type(input, 'a');
      await flushMicrotasks();

      // Should only show first 2 filtered items
      expect(screen.getByRole('option', { name: 'apple' })).not.toBe(null);
      expect(screen.getByRole('option', { name: 'apricot' })).not.toBe(null);
      expect(screen.queryByRole('option', { name: 'avocado' })).toBe(null);
      expect(screen.queryByRole('option', { name: 'banana' })).toBe(null);
      expect(screen.queryByRole('option', { name: 'blueberry' })).toBe(null);
    });

    it('shows all items when limit is -1 (default)', async () => {
      const items = ['apple', 'banana', 'cherry', 'date', 'elderberry'];
      await render(
        <Combobox.Root items={items} limit={-1} defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item) => (
                    <Combobox.Item key={item} value={item}>
                      {item}
                    </Combobox.Item>
                  )}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      // Should show all items
      expect(screen.getByRole('option', { name: 'apple' })).not.toBe(null);
      expect(screen.getByRole('option', { name: 'banana' })).not.toBe(null);
      expect(screen.getByRole('option', { name: 'cherry' })).not.toBe(null);
      expect(screen.getByRole('option', { name: 'date' })).not.toBe(null);
      expect(screen.getByRole('option', { name: 'elderberry' })).not.toBe(null);
    });

    it('handles limit of 0 gracefully', async () => {
      const items = ['apple', 'banana', 'cherry'];
      await render(
        <Combobox.Root items={items} limit={0} defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item) => (
                    <Combobox.Item key={item} value={item}>
                      {item}
                    </Combobox.Item>
                  )}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      // Should show no items
      expect(screen.queryByRole('option', { name: 'apple' })).toBe(null);
      expect(screen.queryByRole('option', { name: 'banana' })).toBe(null);
      expect(screen.queryByRole('option', { name: 'cherry' })).toBe(null);
    });

    it('preserves order of items when applying limit across groups', async () => {
      const items = [
        {
          value: 'groupA',
          items: ['A1', 'A2'],
        },
        {
          value: 'groupB',
          items: ['B1', 'B2', 'B3'],
        },
      ];

      await render(
        <Combobox.Root items={items} limit={3} defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(group) => (
                    <Combobox.Group key={group.value} items={group.items}>
                      <Combobox.GroupLabel>Group {group.value.slice(-1)}</Combobox.GroupLabel>
                      <Combobox.Collection>
                        {(item) => (
                          <Combobox.Item key={item} value={item}>
                            {item}
                          </Combobox.Item>
                        )}
                      </Combobox.Collection>
                    </Combobox.Group>
                  )}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      // Should show first 3 items in order: A1, A2, B1
      expect(screen.getByRole('option', { name: 'A1' })).not.toBe(null);
      expect(screen.getByRole('option', { name: 'A2' })).not.toBe(null);
      expect(screen.getByRole('option', { name: 'B1' })).not.toBe(null);
      expect(screen.queryByRole('option', { name: 'B2' })).toBe(null);
      expect(screen.queryByRole('option', { name: 'B3' })).toBe(null);
    });

    it('does not limit items when not using items prop', async () => {
      await render(
        <Combobox.Root limit={2} defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="apple">apple</Combobox.Item>
                  <Combobox.Item value="banana">banana</Combobox.Item>
                  <Combobox.Item value="cherry">cherry</Combobox.Item>
                  <Combobox.Item value="date">date</Combobox.Item>
                  <Combobox.Item value="elderberry">elderberry</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      // Should show all items because limit only works with items prop
      expect(screen.getByRole('option', { name: 'apple' })).not.toBe(null);
      expect(screen.getByRole('option', { name: 'banana' })).not.toBe(null);
      expect(screen.getByRole('option', { name: 'cherry' })).not.toBe(null);
      expect(screen.getByRole('option', { name: 'date' })).not.toBe(null);
      expect(screen.getByRole('option', { name: 'elderberry' })).not.toBe(null);
    });

    it('updates displayed items when limit changes', async () => {
      const items = ['apple', 'banana', 'cherry', 'date'];
      const { setProps } = await render(
        <Combobox.Root items={items} limit={2} defaultOpen>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item) => (
                    <Combobox.Item key={item} value={item}>
                      {item}
                    </Combobox.Item>
                  )}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      // Initially shows 2 items
      expect(screen.getByRole('option', { name: 'apple' })).not.toBe(null);
      expect(screen.getByRole('option', { name: 'banana' })).not.toBe(null);
      expect(screen.queryByRole('option', { name: 'cherry' })).toBe(null);
      expect(screen.queryByRole('option', { name: 'date' })).toBe(null);

      // Update limit to 3
      await setProps({ limit: 3 });
      await flushMicrotasks();

      // Now shows 3 items
      expect(screen.getByRole('option', { name: 'apple' })).not.toBe(null);
      expect(screen.getByRole('option', { name: 'banana' })).not.toBe(null);
      expect(screen.getByRole('option', { name: 'cherry' })).not.toBe(null);
      expect(screen.queryByRole('option', { name: 'date' })).toBe(null);
    });
  });

  describe('dialog pattern', () => {
    const fruits = ['Apple', 'Apricot', 'Banana', 'Grape', 'Orange'];
    const asyncFruits = ['apple', 'banana', 'cherry'];

    function AsyncDialogCombobox() {
      const [loading, setLoading] = React.useState(true);
      const [value, setValue] = React.useState<string | null>(null);

      React.useEffect(() => {
        const timeout = setTimeout(() => setLoading(false), 0);
        return () => clearTimeout(timeout);
      }, []);

      return (
        <Dialog.Root open>
          <Dialog.Portal>
            <Dialog.Backdrop />
            <Dialog.Popup>
              <form>
                <label htmlFor="name">Name</label>
                <input id="name" disabled={loading} />

                <label htmlFor="fruit">Fruit</label>
                <Combobox.Root
                  items={asyncFruits}
                  value={value}
                  onValueChange={setValue}
                  disabled={loading}
                >
                  <Combobox.Input id="fruit" placeholder="Select fruit..." />
                  <Combobox.Trigger aria-label="Open" />
                  <Combobox.Portal>
                    <Combobox.Positioner>
                      <Combobox.Popup>
                        <Combobox.List>
                          {(item: string) => (
                            <Combobox.Item key={item} value={item}>
                              {item}
                            </Combobox.Item>
                          )}
                        </Combobox.List>
                      </Combobox.Popup>
                    </Combobox.Positioner>
                  </Combobox.Portal>
                </Combobox.Root>

                <button type="button">Cancel</button>
                <button type="submit" disabled={loading}>
                  Save
                </button>
              </form>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      );
    }

    function DialogMultipleCombobox({ defaultOpen = true }: { defaultOpen?: boolean }) {
      const [open, setOpen] = React.useState(defaultOpen);
      return (
        <Combobox.Root multiple items={fruits} inline>
          <Dialog.Root open={open} onOpenChange={setOpen}>
            <Dialog.Trigger>Trigger</Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Popup aria-label="Fruit chooser">
                <Combobox.Chips>
                  <Combobox.Input data-testid="dialog-input" />
                  <Combobox.List>
                    {(item: string) => (
                      <Combobox.Item key={item} value={item}>
                        {item}
                      </Combobox.Item>
                    )}
                  </Combobox.List>
                </Combobox.Chips>
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
        </Combobox.Root>
      );
    }

    function DialogSingleCombobox({ defaultOpen = true }: { defaultOpen?: boolean }) {
      const [open, setOpen] = React.useState(defaultOpen);
      const inputId = React.useId();

      return (
        <Combobox.Root items={fruits} open={open} onOpenChange={setOpen} inline>
          <Dialog.Root open={open} onOpenChange={setOpen}>
            <Dialog.Trigger data-testid="dialog-trigger">
              <Combobox.Value>
                {(value: string | null) => (value == null ? 'Select a fruit' : value)}
              </Combobox.Value>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Popup aria-label="Fruit chooser">
                <div>
                  <label htmlFor={inputId}>Fruit</label>
                  <Combobox.Input
                    id={inputId}
                    data-testid="dialog-input"
                    placeholder="e.g. Apple"
                  />
                </div>
                <Combobox.List>
                  {(item: string) => (
                    <Combobox.Item key={item} value={item}>
                      {item}
                    </Combobox.Item>
                  )}
                </Combobox.List>
                <Dialog.Close>Done</Dialog.Close>
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
        </Combobox.Root>
      );
    }

    it('does not let pending dialog initial focus steal focus from an async-enabled combobox', async () => {
      // Keep the dialog's initial-focus rAF pending until after the combobox click.
      // The GitHub repro depends on this timing; otherwise the rAF can fire before the click.
      const frameCallbacks = new Map<number, FrameRequestCallback>();
      let frameId = 0;
      const requestAnimationFrameSpy = vi
        .spyOn(window, 'requestAnimationFrame')
        .mockImplementation((callback) => {
          frameId += 1;
          frameCallbacks.set(frameId, callback);
          return frameId;
        });
      const cancelAnimationFrameSpy = vi
        .spyOn(window, 'cancelAnimationFrame')
        .mockImplementation((id) => {
          frameCallbacks.delete(id);
        });

      try {
        const { user } = await render(<AsyncDialogCombobox />);

        await waitFor(() => expect(screen.getByLabelText('Fruit')).toBeEnabled());
        await user.click(screen.getByLabelText('Fruit'));

        expect(await screen.findByRole('listbox')).toBeVisible();

        act(() => {
          const callbacks = Array.from(frameCallbacks.values());
          frameCallbacks.clear();
          callbacks.forEach((callback) => callback(performance.now()));
        });

        expect(screen.getByLabelText('Fruit')).toHaveFocus();
        expect(screen.getByRole('listbox')).toBeVisible();
      } finally {
        requestAnimationFrameSpy.mockRestore();
        cancelAnimationFrameSpy.mockRestore();
      }
    });

    describe('multiple', () => {
      it('clears input after filtering, removes filter and highlight', async () => {
        const { user } = await render(<DialogMultipleCombobox />);

        const input = await screen.findByTestId('dialog-input');

        await user.type(input, 'ap');

        await waitFor(() => {
          expect(screen.queryByRole('option', { name: 'Banana' })).toBe(null);
        });
        expect(screen.getByRole('option', { name: 'Apple' })).not.toBe(null);
        expect(screen.getByRole('option', { name: 'Apricot' })).not.toBe(null);

        await user.click(screen.getByRole('option', { name: 'Apple' }));

        expect(input).toHaveValue('');
        await waitFor(() => {
          expect(screen.queryByRole('option', { name: 'Banana' })).not.toBe(null);
        });
        expect(input).toHaveAttribute('aria-activedescendant');
      });

      it('still filters after selecting an item', async () => {
        const { user } = await render(<DialogMultipleCombobox />);

        const input = await screen.findByTestId('dialog-input');

        await user.type(input, 'ap');

        await waitFor(() => {
          expect(screen.queryByRole('option', { name: 'Banana' })).toBe(null);
        });
        expect(screen.getByRole('option', { name: 'Apple' })).not.toBe(null);
        expect(screen.getByRole('option', { name: 'Apricot' })).not.toBe(null);

        await user.click(screen.getByRole('option', { name: 'Apple' }));

        expect(input).toHaveValue('');
        await waitFor(() => {
          expect(screen.queryByRole('option', { name: 'Banana' })).not.toBe(null);
        });
        expect(input).toHaveAttribute('aria-activedescendant');

        await user.type(input, 'ap');

        await waitFor(() => {
          expect(screen.queryByRole('option', { name: 'Banana' })).toBe(null);
        });
      });

      it('retains highlight on selected item when not filtering', async () => {
        const { user } = await render(<DialogMultipleCombobox />);

        const input = await screen.findByTestId('dialog-input');

        await act(async () => {
          input.focus();
        });

        await user.keyboard('{ArrowDown}');
        await waitFor(() => {
          const apple = screen.getByRole('option', { name: 'Apple' });
          expect(input).toHaveAttribute('aria-activedescendant', apple.id);
        });

        await user.keyboard('{Enter}');

        await waitFor(() => {
          const apple = screen.getByRole('option', { name: 'Apple' });
          expect(input).toHaveAttribute('aria-activedescendant', apple.id);
        });
      });
    });

    describe('single', () => {
      it('closes the dialog after selecting an item and updates the trigger value', async () => {
        if (reactMajor <= 18) {
          ignoreActWarnings();
        }

        const { user } = await render(<DialogSingleCombobox defaultOpen={false} />);

        const trigger = screen.getByTestId('dialog-trigger');
        await user.click(trigger);

        await screen.findByRole('dialog', { name: 'Fruit chooser' });
        const input = await screen.findByTestId('dialog-input');

        await user.type(input, 'ap');
        await user.click(screen.getByRole('option', { name: 'Apple' }));

        await waitFor(() => {
          expect(screen.queryByRole('dialog', { name: 'Fruit chooser' })).toBe(null);
        });

        await waitFor(() => {
          expect(trigger).toHaveTextContent('Apple');
        });
      });

      it('clears the filter input when re-opening after a selection', async () => {
        if (reactMajor <= 18) {
          ignoreActWarnings();
        }

        const { user } = await render(<DialogSingleCombobox defaultOpen={false} />);

        const trigger = screen.getByTestId('dialog-trigger');
        await user.click(trigger);

        await screen.findByRole('dialog', { name: 'Fruit chooser' });
        const input = await screen.findByTestId('dialog-input');

        await user.type(input, 'ap');
        await user.click(screen.getByRole('option', { name: 'Apple' }));

        await waitFor(() => {
          expect(screen.queryByRole('dialog', { name: 'Fruit chooser' })).toBe(null);
        });

        await user.click(trigger);

        await screen.findByRole('dialog', { name: 'Fruit chooser' });
        const reopenedInput = await screen.findByTestId('dialog-input');

        expect(reopenedInput).toHaveValue('');
        await screen.findByRole('option', { name: 'Banana' });
      });

      it('restores highlight when the input regains focus', async () => {
        const { user } = await render(<DialogSingleCombobox />);

        const input = await screen.findByTestId('dialog-input');

        await act(async () => {
          input.focus();
        });

        await user.keyboard('{ArrowDown}');

        const apple = screen.getByRole('option', { name: 'Apple' });

        await waitFor(() => {
          expect(apple).toHaveAttribute('data-highlighted');
          expect(input).toHaveAttribute('aria-activedescendant', apple.id);
        });

        const done = screen.getByRole('button', { name: 'Done' });
        fireEvent.blur(input, { relatedTarget: done });
        fireEvent.focus(done);

        await waitFor(() => {
          expect(input).not.toHaveAttribute('aria-activedescendant');
          expect(apple).not.toHaveAttribute('data-highlighted');
        });

        fireEvent.blur(done, { relatedTarget: input });
        fireEvent.focus(input);

        await waitFor(() => {
          expect(apple).toHaveAttribute('data-highlighted');
          expect(input).toHaveAttribute('aria-activedescendant', apple.id);
        });
      });
    });
  });

  describe('Form', () => {
    const { render: renderFakeTimers, clock } = createRenderer({
      clockOptions: {
        shouldAdvanceTime: true,
      },
    });

    clock.withFakeTimers();

    it('submits stringified value to onFormSubmit when itemToStringValue is provided', async () => {
      const items = [
        { code: 'US', label: 'United States' },
        { code: 'CA', label: 'Canada' },
      ];
      const handleFormSubmit = vi.fn();

      const { user } = await renderFakeTimers(
        <Form onFormSubmit={handleFormSubmit}>
          <Field.Root name="country">
            <Combobox.Root
              items={items}
              itemToStringLabel={(item) => item.label}
              itemToStringValue={(item) => item.code}
              defaultValue={items[0]}
            >
              <Combobox.Input />
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.List>
                      {(item: (typeof items)[number]) => (
                        <Combobox.Item key={item.code} value={item}>
                          {item.label}
                        </Combobox.Item>
                      )}
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      await user.click(screen.getByText('Submit'));

      expect(handleFormSubmit.mock.calls.length).toBe(1);
      expect(handleFormSubmit.mock.calls[0][0]).toEqual({ country: 'US' });
    });

    it.skipIf(isJSDOM)('submits to an external form when `form` is provided', async () => {
      const submitSpy = vi.fn((event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        return formData.get('country');
      });

      const items = [
        { code: 'US', label: 'United States' },
        { code: 'CA', label: 'Canada' },
      ];

      await render(
        <React.Fragment>
          <form id="external-form" onSubmit={submitSpy}>
            <button type="submit">Submit</button>
          </form>
          <Combobox.Root
            name="country"
            form="external-form"
            items={items}
            itemToStringLabel={(item) => item.label}
            itemToStringValue={(item) => item.code}
            defaultValue={items[0]}
          >
            <Combobox.Input />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    {(item: (typeof items)[number]) => (
                      <Combobox.Item key={item.code} value={item}>
                        {item.label}
                      </Combobox.Item>
                    )}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        </React.Fragment>,
      );

      fireEvent.click(screen.getByRole('button'));

      expect(submitSpy.mock.calls.length).toBe(1);
      expect(submitSpy.mock.results.at(-1)?.value).toBe('US');
    });

    it.skipIf(isJSDOM)(
      'submits multiple values to an external form when `form` is provided',
      async () => {
        const submitSpy = vi.fn((event: React.FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          return formData.getAll('countries');
        });

        const items = [
          { code: 'US', label: 'United States' },
          { code: 'CA', label: 'Canada' },
          { code: 'AU', label: 'Australia' },
        ];

        await render(
          <React.Fragment>
            <form id="external-form" onSubmit={submitSpy}>
              <button type="submit">Submit</button>
            </form>
            <Combobox.Root
              multiple
              name="countries"
              form="external-form"
              items={items}
              itemToStringLabel={(item) => item.label}
              itemToStringValue={(item) => item.code}
              defaultValue={[items[0], items[2]]}
            >
              <Combobox.Input />
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.List>
                      {(item: (typeof items)[number]) => (
                        <Combobox.Item key={item.code} value={item}>
                          {item.label}
                        </Combobox.Item>
                      )}
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          </React.Fragment>,
        );

        fireEvent.click(screen.getByRole('button'));

        expect(submitSpy.mock.calls.length).toBe(1);
        expect(submitSpy.mock.results.at(-1)?.value).toEqual(['US', 'AU']);
      },
    );

    describe('serialization for object values', () => {
      const items = [
        { value: 'US', label: 'United States' },
        { value: 'CA', label: 'Canada' },
        { value: 'AU', label: 'Australia' },
      ];

      it('serializes {value,label} objects using their value field', async () => {
        await render(
          <Combobox.Root
            name="country"
            items={items}
            itemToStringLabel={(item) => item.label}
            defaultValue={items[1]}
          >
            <Combobox.Input />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    {(item: { value: string; label: string }) => (
                      <Combobox.Item key={item.value} value={item}>
                        {item.label}
                      </Combobox.Item>
                    )}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>,
        );

        const hiddenInput = screen.getByDisplayValue('CA');
        expect(hiddenInput.tagName).toBe('INPUT');
        expect(hiddenInput).toHaveAttribute('name', 'country');
      });

      it('serializes multiple {value,label} objects into multiple hidden inputs', async () => {
        const values = [items[0], items[2]];
        const { container } = await render(
          <Combobox.Root
            name="countries"
            items={items}
            itemToStringLabel={(item) => item.label}
            multiple
            defaultValue={values}
          >
            <Combobox.Input />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    {(item: { value: string; label: string }) => (
                      <Combobox.Item key={item.value} value={item}>
                        {item.label}
                      </Combobox.Item>
                    )}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>,
        );

        // eslint-disable-next-line testing-library/no-container -- Can't avoid container here. A better test would be checking form submission.
        const hiddenInputs = container.querySelectorAll('input[name="countries"]');
        expect(hiddenInputs).toHaveLength(values.length);
        values.forEach((item, index) => {
          expect(hiddenInputs[index]).toHaveValue(item.value);
        });
      });

      it('falls back to itemToStringValue when object lacks value', async () => {
        const codeItems = [
          { code: 'US', name: 'United States' },
          { code: 'CA', name: 'Canada' },
          { code: 'AU', name: 'Australia' },
        ];

        const { container } = await render(
          <Combobox.Root
            name="country"
            items={codeItems}
            itemToStringLabel={(item) => item.name}
            itemToStringValue={(item) => item.code}
            defaultValue={codeItems[0]}
          >
            <Combobox.Input />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    {(item: { code: string; name: string }) => (
                      <Combobox.Item key={item.code} value={item}>
                        {item.name}
                      </Combobox.Item>
                    )}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>,
        );

        // eslint-disable-next-line testing-library/no-container -- Can't avoid container here. A better test would be checking form submission.
        const hiddenInput = container.querySelector('input[name="country"]');
        expect(hiddenInput).toHaveValue('US');
      });
    });

    it('triggers native HTML validation on submit', async () => {
      const { user } = await render(
        <Form>
          <Field.Root name="test" data-testid="field">
            <Combobox.Root required>
              <Combobox.Input data-testid="input" />
              <Combobox.Portal>
                <Combobox.Positioner />
              </Combobox.Portal>
            </Combobox.Root>
            <Field.Error match="valueMissing" data-testid="error">
              required
            </Field.Error>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      const submit = screen.getByText('Submit');

      expect(screen.queryByTestId('error')).toBe(null);

      await user.click(submit);

      const error = screen.getByTestId('error');
      expect(error).toHaveTextContent('required');
    });

    it('focuses trigger and surfaces errors when input is inside popup', async () => {
      ignoreActWarnings();

      let submittedCalls = 0;

      const handleSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
        event.preventDefault();
        submittedCalls += 1;
      };

      const { user } = await render(
        <Form onSubmit={handleSubmit}>
          <Field.Root name="combobox">
            <Combobox.Root required>
              <Combobox.Trigger data-testid="trigger">
                <Combobox.Value />
              </Combobox.Trigger>
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.Input render={<Input data-testid="input" />} />
                    <Combobox.List>
                      <Combobox.Item value="a">a</Combobox.Item>
                      <Combobox.Item value="b">b</Combobox.Item>
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
            <Field.Error match="valueMissing" data-testid="error">
              required
            </Field.Error>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      expect(screen.queryByTestId('error')).toBe(null);

      await user.click(screen.getByText('Submit'));

      expect(submittedCalls).toBe(0);

      const trigger = screen.getByTestId('trigger');

      await waitFor(() => expect(trigger).toHaveFocus());
      expect(trigger).toHaveAttribute('data-invalid', '');

      const error = screen.getByTestId('error');
      expect(error).toHaveTextContent('required');

      await user.click(trigger);

      const input = await screen.findByTestId('input');
      expect(input).not.toHaveAttribute('data-invalid');
    });

    it('submits when input renders a field-aware input', async () => {
      const handleFormSubmit = vi.fn();

      const { user } = await render(
        <Form onFormSubmit={handleFormSubmit}>
          <Field.Root name="country">
            <Combobox.Root items={['France', 'Germany']} required>
              <Combobox.Input render={<Input data-testid="input" />} />
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.List>
                      {(item: string) => (
                        <Combobox.Item key={item} value={item}>
                          {item}
                        </Combobox.Item>
                      )}
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      const input = screen.getByTestId('input');
      expect(input).toHaveAttribute('name', 'country');

      await user.click(input);
      await user.click(screen.getByRole('option', { name: 'France' }));
      await user.click(screen.getByText('Submit'));

      expect(handleFormSubmit.mock.calls.length).toBe(1);
      expect(handleFormSubmit.mock.calls[0][0]).toEqual({ country: 'France' });
    });

    it('submits when input inside popup renders a field-aware input', async () => {
      const handleFormSubmit = vi.fn();

      const { user } = await render(
        <Form onFormSubmit={handleFormSubmit}>
          <Field.Root name="country">
            <Combobox.Root items={['France', 'Germany']} required>
              <Combobox.Trigger>
                <Combobox.Value />
              </Combobox.Trigger>
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.Input render={<Input data-testid="input" />} />
                    <Combobox.List>
                      {(item: string) => (
                        <Combobox.Item key={item} value={item}>
                          {item}
                        </Combobox.Item>
                      )}
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      await user.click(screen.getByRole('combobox'));
      const input = await screen.findByTestId('input');
      expect(input).not.toHaveAttribute('name');

      await user.click(screen.getByRole('option', { name: 'France' }));

      const hiddenInput = screen.getByRole('textbox', { hidden: true });
      expect(hiddenInput).toHaveAttribute('name', 'country');
      expect(hiddenInput).toHaveValue('France');

      await user.click(screen.getByText('Submit'));

      expect(handleFormSubmit.mock.calls.length).toBe(1);
      expect(handleFormSubmit.mock.calls[0][0]).toEqual({ country: 'France' });
    });

    it('clears external errors on change', async () => {
      const { user } = await renderFakeTimers(
        <Form
          errors={{
            combobox: 'test',
          }}
        >
          <Field.Root name="combobox">
            <Combobox.Root>
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
            </Combobox.Root>
            <Field.Error data-testid="error" />
          </Field.Root>
        </Form>,
      );

      expect(screen.getByTestId('error')).toHaveTextContent('test');

      const input = screen.getByTestId('input');
      expect(input).toHaveAttribute('aria-invalid', 'true');

      await user.click(input);
      await flushMicrotasks();

      const option = screen.getByRole('option', { name: 'b' });
      clock.tick(200);
      await user.click(option);

      expect(screen.queryByTestId('error')).toBe(null);
      expect(input).not.toHaveAttribute('aria-invalid');
    });

    it('submits on Enter when no item is highlighted (does not prevent)', async () => {
      let submittedCalls = 0;

      const handleSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
        event.preventDefault();
        submittedCalls += 1;
      };

      const { user } = await render(
        <Form onSubmit={handleSubmit}>
          <Field.Root name="q">
            <Combobox.Root items={['apple', 'banana']} openOnInputClick>
              <Combobox.Input />
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.List>
                      {(item) => (
                        <Combobox.Item key={item} value={item}>
                          {item}
                        </Combobox.Item>
                      )}
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      const input = screen.getByRole('combobox');
      await user.click(input);
      // No navigation, so nothing highlighted
      await user.keyboard('{Enter}');

      expect(submittedCalls).toBe(1);
    });

    it('prevents submit on Enter when an item is highlighted', async () => {
      let submittedCalls = 0;

      const handleSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
        event.preventDefault();
        submittedCalls += 1;
      };

      const { user } = await render(
        <Form onSubmit={handleSubmit}>
          <Field.Root name="q">
            <Combobox.Root items={['alpha', 'beta']} openOnInputClick>
              <Combobox.Input />
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.List>
                      {(item) => (
                        <Combobox.Item key={item} value={item}>
                          {item}
                        </Combobox.Item>
                      )}
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      const input = screen.getByRole('combobox');
      await user.click(input);
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');

      expect(submittedCalls).toBe(0);
    });
  });

  describe('Field', () => {
    const { render: renderFakeTimers, clock } = createRenderer({
      clockOptions: {
        shouldAdvanceTime: true,
      },
    });

    clock.withFakeTimers();

    it('should receive disabled prop from Field.Root', async () => {
      await render(
        <Field.Root disabled>
          <Combobox.Root>
            <Combobox.Input data-testid="input" />
            <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
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
          </Combobox.Root>
        </Field.Root>,
      );

      const input = screen.getByTestId('input');
      expect(input).toHaveAttribute('disabled');

      const trigger = screen.getByTestId('trigger');
      expect(trigger).toHaveAttribute('disabled');
    });

    it('should receive name prop from Field.Root', async () => {
      await render(
        <Field.Root name="field-combobox">
          <Combobox.Root>
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
          </Combobox.Root>
        </Field.Root>,
      );

      const hiddenInput = screen.getByRole('textbox', { hidden: true });
      expect(hiddenInput).toHaveAttribute('name', 'field-combobox');
    });

    it('Field.Label links to Combobox.Trigger when input is inside popup and trigger has an explicit id', async () => {
      await render(
        <Field.Root>
          <Field.Label data-testid="label">Search</Field.Label>
          <Combobox.Root>
            <Combobox.Trigger data-testid="trigger" id="x-id">
              Open
            </Combobox.Trigger>
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.Input />
                  <Combobox.List>
                    <Combobox.Item value="a">a</Combobox.Item>
                    <Combobox.Item value="b">b</Combobox.Item>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        </Field.Root>,
      );

      const label = screen.getByTestId<HTMLLabelElement>('label');
      const trigger = screen.getByTestId('trigger');

      /* eslint-disable testing-library/no-wait-for-multiple-assertions */
      await waitFor(() => {
        expect(trigger).toHaveAttribute('id', 'x-id');
        expect(trigger).toHaveAttribute('aria-labelledby', label.id);
      });
      /* eslint-enable testing-library/no-wait-for-multiple-assertions */
    });

    it('does not apply validation ARIA attributes to input inside popup', async () => {
      const { user } = await render(
        <Field.Root invalid>
          <Combobox.Root>
            <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.Input data-testid="input" />
                  <Combobox.List>
                    <Combobox.Item value="a">a</Combobox.Item>
                    <Combobox.Item value="b">b</Combobox.Item>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
          <Field.Description data-testid="description" />
          <Field.Error data-testid="error" match />
        </Field.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      const description = screen.getByTestId('description');
      const error = screen.getByTestId('error');
      const triggerDescribedBy = trigger.getAttribute('aria-describedby');

      expect(trigger).toHaveAttribute('aria-invalid', 'true');
      expect(triggerDescribedBy).toContain(description.id);
      expect(triggerDescribedBy).toContain(error.id);

      await user.click(trigger);

      const input = await screen.findByTestId('input');

      expect(input).not.toHaveAttribute('aria-invalid');
      expect(input).not.toHaveAttribute('aria-describedby');
      expect(input).not.toHaveAttribute('data-valid');
      expect(input).not.toHaveAttribute('data-invalid');
      expect(input).not.toHaveAttribute('data-touched');
      expect(input).not.toHaveAttribute('data-dirty');
      expect(input).not.toHaveAttribute('data-filled');
      expect(input).not.toHaveAttribute('data-focused');
    });

    it('Combobox.Label links to Combobox.Trigger when input is inside popup and trigger has an explicit id', async () => {
      await render(
        <Combobox.Root>
          <Combobox.Label data-testid="label">Search</Combobox.Label>
          <Combobox.Trigger data-testid="trigger" id="x-id">
            Open
          </Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Input />
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                  <Combobox.Item value="b">b</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const label = screen.getByTestId<HTMLDivElement>('label');
      const trigger = screen.getByTestId('trigger');

      /* eslint-disable testing-library/no-wait-for-multiple-assertions */
      await waitFor(() => {
        expect(trigger).toHaveAttribute('id', 'x-id');
        expect(trigger).toHaveAttribute('aria-labelledby', label.id);
      });
      /* eslint-enable testing-library/no-wait-for-multiple-assertions */
    });

    it('Combobox.Label focuses trigger without opening when input is inside popup', async () => {
      const { user } = await render(
        <Combobox.Root>
          <Combobox.Label data-testid="label">Search</Combobox.Label>
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Input />
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                  <Combobox.Item value="b">b</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      await user.click(screen.getByTestId('label'));

      expect(screen.getByTestId('trigger')).toHaveFocus();
      expect(screen.queryByRole('dialog')).toBe(null);
    });

    it('[data-touched]', async () => {
      await render(
        <Field.Root>
          <Combobox.Root>
            <Combobox.Input data-testid="input" />
            <Combobox.Trigger data-testid="trigger" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    <Combobox.Item value="">Select</Combobox.Item>
                    <Combobox.Item value="1">Option 1</Combobox.Item>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        </Field.Root>,
      );

      const input = screen.getByTestId('input');
      const trigger = screen.getByTestId('trigger');

      expect(input).not.toHaveAttribute('data-dirty');
      expect(trigger).not.toHaveAttribute('data-dirty');

      fireEvent.focus(input);
      fireEvent.blur(input);

      await flushMicrotasks();

      expect(input).toHaveAttribute('data-touched', '');
      expect(trigger).toHaveAttribute('data-touched', '');
    });

    it('[data-dirty]', async () => {
      const { user } = await renderFakeTimers(
        <Field.Root>
          <Combobox.Root>
            <Combobox.Input data-testid="input" />
            <Combobox.Trigger data-testid="trigger" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    <Combobox.Item value="">Select</Combobox.Item>
                    <Combobox.Item value="1">Option 1</Combobox.Item>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        </Field.Root>,
      );

      const input = screen.getByTestId('input');
      const trigger = screen.getByTestId('trigger');

      expect(input).not.toHaveAttribute('data-dirty');
      expect(trigger).not.toHaveAttribute('data-dirty');

      await user.click(input);
      await flushMicrotasks();
      clock.tick(200);

      const option = screen.getByRole('option', { name: 'Option 1' });

      // Arrow Down to focus the Option 1
      await user.keyboard('{ArrowDown}');
      await user.click(option);
      await flushMicrotasks();

      expect(input).toHaveAttribute('data-dirty', '');
      expect(trigger).toHaveAttribute('data-dirty', '');
    });

    it('removes [data-dirty] in multiple mode after returning to the initial value', async () => {
      const { user } = await render(
        <Field.Root>
          <Combobox.Root multiple defaultOpen defaultValue={['a']}>
            <Combobox.Input data-testid="input" />
            <Combobox.Trigger data-testid="trigger" />
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
          </Combobox.Root>
        </Field.Root>,
      );

      const input = screen.getByTestId('input');
      const trigger = screen.getByTestId('trigger');
      const optionB = screen.getByRole('option', { name: 'b' });

      expect(input).not.toHaveAttribute('data-dirty');
      expect(trigger).not.toHaveAttribute('data-dirty');

      await user.click(optionB);

      await waitFor(() => {
        expect(input).toHaveAttribute('data-dirty', '');
      });
      await waitFor(() => {
        expect(trigger).toHaveAttribute('data-dirty', '');
      });

      await user.click(optionB);

      await waitFor(() => {
        expect(input).not.toHaveAttribute('data-dirty');
      });
      await waitFor(() => {
        expect(trigger).not.toHaveAttribute('data-dirty');
      });
    });

    it('removes [data-dirty] when an equal object value is reselected (different reference)', async () => {
      const options = [
        { id: 'a', label: 'a' },
        { id: 'b', label: 'b' },
      ];

      const { user } = await render(
        <Field.Root>
          <Combobox.Root
            multiple
            defaultOpen
            items={options}
            // The initial value is a different object reference than the rendered items, equal only
            // by the `isItemEqualToValue` comparator.
            defaultValue={[{ id: 'a', label: 'a' }]}
            itemToStringLabel={(item) => item.label}
            itemToStringValue={(item) => item.id}
            isItemEqualToValue={(item, value) => item.id === value.id}
          >
            <Combobox.Trigger data-testid="trigger" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    {(item) => (
                      <Combobox.Item key={item.id} value={item}>
                        {item.label}
                      </Combobox.Item>
                    )}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        </Field.Root>,
      );

      const trigger = screen.getByTestId('trigger');

      expect(trigger).not.toHaveAttribute('data-dirty');

      await user.click(screen.getByRole('option', { name: 'a' }));

      await waitFor(() => {
        expect(trigger).toHaveAttribute('data-dirty', '');
      });

      // Reselecting adds the item's object, a different reference than the initial value. The field
      // only returns to pristine if the dirty check compares via the provided comparator rather
      // than by reference.
      await user.click(screen.getByRole('option', { name: 'a' }));

      await waitFor(() => {
        expect(trigger).not.toHaveAttribute('data-dirty');
      });
    });

    it('keeps [data-dirty] when the same values are reselected in a different order', async () => {
      const { user } = await render(
        <Field.Root>
          <Combobox.Root multiple defaultOpen defaultValue={['a', 'b']}>
            <Combobox.Trigger data-testid="trigger" />
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
          </Combobox.Root>
        </Field.Root>,
      );

      const trigger = screen.getByTestId('trigger');

      expect(trigger).not.toHaveAttribute('data-dirty');

      // Deselect 'a' -> ['b'].
      await user.click(screen.getByRole('option', { name: 'a' }));
      await waitFor(() => {
        expect(trigger).toHaveAttribute('data-dirty', '');
      });

      // Reselect 'a' -> ['b', 'a']. The set matches the initial value but the order differs.
      // Order is significant (it is preserved in form submission and compared element-by-element),
      // so the field stays dirty.
      await user.click(screen.getByRole('option', { name: 'a' }));
      expect(trigger).toHaveAttribute('data-dirty', '');
    });

    describe('[data-filled]', () => {
      it('adds [data-filled] attribute when filled', async () => {
        const { user } = await renderFakeTimers(
          <Field.Root>
            <Combobox.Root>
              <Combobox.Input data-testid="input" />
              <Combobox.Trigger data-testid="trigger" />
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.List>
                      <Combobox.Item value="">Select</Combobox.Item>
                      <Combobox.Item value="1">Option 1</Combobox.Item>
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          </Field.Root>,
        );

        const input = screen.getByTestId('input');
        const trigger = screen.getByTestId('trigger');

        expect(input).not.toHaveAttribute('data-filled');
        expect(trigger).not.toHaveAttribute('data-filled');

        await user.click(input);
        await flushMicrotasks();
        clock.tick(200);

        const option = screen.getByRole('option', { name: 'Option 1' });

        // Arrow Down to focus the Option 1
        await user.keyboard('{ArrowDown}');
        await user.click(option);
        await flushMicrotasks();

        expect(input).toHaveAttribute('data-filled', '');
        expect(trigger).toHaveAttribute('data-filled', '');

        await user.click(input);

        await flushMicrotasks();

        const listbox = screen.getByRole('listbox');

        expect(listbox).not.toHaveAttribute('data-filled');
      });

      it('adds [data-filled] attribute when already filled', async () => {
        await render(
          <Field.Root>
            <Combobox.Root defaultValue="1">
              <Combobox.Input data-testid="input" />
              <Combobox.Trigger data-testid="trigger" />
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.List>
                      <Combobox.Item value="1">Option 1</Combobox.Item>
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          </Field.Root>,
        );

        const input = screen.getByTestId('input');
        const trigger = screen.getByTestId('trigger');

        expect(input).toHaveAttribute('data-filled');
        expect(trigger).toHaveAttribute('data-filled');
      });
    });

    it('[data-focused]', async () => {
      await render(
        <Field.Root>
          <Combobox.Root>
            <Combobox.Input data-testid="input" />
            <Combobox.Trigger data-testid="trigger" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    <Combobox.Item value="">Select</Combobox.Item>
                    <Combobox.Item value="1">Option 1</Combobox.Item>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        </Field.Root>,
      );

      const input = screen.getByTestId('input');
      const trigger = screen.getByTestId('trigger');

      expect(input).not.toHaveAttribute('data-focused');
      expect(trigger).not.toHaveAttribute('data-focused');

      fireEvent.focus(input);

      expect(input).toHaveAttribute('data-focused', '');
      expect(trigger).toHaveAttribute('data-focused', '');

      fireEvent.blur(input);

      expect(input).not.toHaveAttribute('data-focused');
      expect(trigger).not.toHaveAttribute('data-focused');
    });

    it('does not mark as touched when focus moves into the popup', async () => {
      const validateSpy = vi.fn(() => 'error');

      await render(
        <React.Fragment>
          <Field.Root validationMode="onBlur" validate={validateSpy}>
            <Combobox.Root>
              <Combobox.Trigger data-testid="trigger" />
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.List>
                      <Combobox.Item value="1">Option 1</Combobox.Item>
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          </Field.Root>
          <button data-testid="outside">Outside</button>
        </React.Fragment>,
      );

      const trigger = screen.getByTestId('trigger');

      fireEvent.focus(trigger);
      fireEvent.click(trigger);

      await flushMicrotasks();

      const popup = screen.getByRole('dialog');

      fireEvent.blur(trigger, { relatedTarget: popup });
      fireEvent.focus(popup);

      await flushMicrotasks();

      expect(validateSpy.mock.calls.length).toBe(0);
      expect(trigger).toHaveAttribute('data-focused', '');
      expect(trigger).not.toHaveAttribute('data-touched');
      expect(trigger).not.toHaveAttribute('aria-invalid');
    });

    it('validates when the popup is blurred', async () => {
      const validateSpy = vi.fn(() => 'error');

      await render(
        <React.Fragment>
          <Field.Root validationMode="onBlur" validate={validateSpy}>
            <Combobox.Root>
              <Combobox.Trigger data-testid="trigger" />
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.List>
                      <Combobox.Item value="1">Option 1</Combobox.Item>
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
          </Field.Root>
          <button data-testid="outside">Outside</button>
        </React.Fragment>,
      );

      const trigger = screen.getByTestId('trigger');
      const outside = screen.getByTestId('outside');

      fireEvent.focus(trigger);
      fireEvent.click(trigger);

      await flushMicrotasks();

      const popup = screen.getByRole('dialog');

      fireEvent.blur(trigger, { relatedTarget: popup });
      fireEvent.focus(popup);

      fireEvent.blur(popup, { relatedTarget: outside });
      fireEvent.focus(outside);

      await waitFor(() => {
        expect(validateSpy.mock.calls.length).toBe(1);
      });

      expect(trigger).toHaveAttribute('data-touched', '');
      expect(trigger).not.toHaveAttribute('data-focused');
      expect(trigger).toHaveAttribute('aria-invalid', 'true');
    });

    it('[data-invalid]', async () => {
      await render(
        <Field.Root invalid>
          <Combobox.Root>
            <Combobox.Input data-testid="input" />
            <Combobox.Trigger data-testid="trigger" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    <Combobox.Item value="1">Option 1</Combobox.Item>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        </Field.Root>,
      );

      const input = screen.getByTestId('input');
      const trigger = screen.getByTestId('trigger');

      expect(input).toHaveAttribute('data-invalid', '');
      expect(trigger).toHaveAttribute('data-invalid', '');
    });

    it('[data-valid]', async () => {
      const { user } = await render(
        <Field.Root validationMode="onBlur">
          <Combobox.Root>
            <Combobox.Input data-testid="input" required />
            <Combobox.Trigger data-testid="trigger" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    <Combobox.Item value="1">Option 1</Combobox.Item>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        </Field.Root>,
      );

      const input = screen.getByTestId('input');
      const trigger = screen.getByTestId('trigger');

      expect(input).not.toHaveAttribute('data-valid');
      expect(input).not.toHaveAttribute('data-invalid');
      expect(trigger).not.toHaveAttribute('data-valid');
      expect(trigger).not.toHaveAttribute('data-invalid');

      // Select an option to produce a valid value, then blur to commit
      fireEvent.focus(input);
      await user.click(input);
      const option = await screen.findByRole('option', { name: 'Option 1' });

      await user.click(option);
      fireEvent.blur(input);

      await waitFor(() => expect(input).toHaveAttribute('data-valid', ''));
      expect(trigger).toHaveAttribute('data-valid', '');
      expect(input).not.toHaveAttribute('data-invalid');
      expect(trigger).not.toHaveAttribute('data-invalid');
    });

    it('prop: validate', async () => {
      await render(
        <Field.Root validationMode="onBlur" validate={() => 'error'}>
          <Combobox.Root>
            <Combobox.Input data-testid="input" />
            <Combobox.Portal>
              <Combobox.Positioner />
            </Combobox.Portal>
          </Combobox.Root>
        </Field.Root>,
      );

      const input = screen.getByTestId('input');

      expect(input).not.toHaveAttribute('aria-invalid');

      fireEvent.focus(input);
      fireEvent.blur(input);

      await flushMicrotasks();

      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('passes raw value to validate when itemToStringValue is provided', async () => {
      const items = [
        { code: 'US', label: 'United States' },
        { code: 'CA', label: 'Canada' },
      ];
      const validateSpy = vi.fn((value: unknown) => {
        expect(value).toBe(items[0]);
        return 'error';
      });

      await render(
        <Field.Root validationMode="onBlur" validate={validateSpy}>
          <Combobox.Root
            items={items}
            defaultValue={items[0]}
            itemToStringLabel={(item) => item.label}
            itemToStringValue={(item) => item.code}
          >
            <Combobox.Input data-testid="input" />
            <Combobox.Portal>
              <Combobox.Positioner />
            </Combobox.Portal>
          </Combobox.Root>
        </Field.Root>,
      );

      const input = screen.getByTestId('input');

      fireEvent.focus(input);
      fireEvent.blur(input);

      await waitFor(() => {
        expect(validateSpy.mock.calls.length).toBe(1);
      });
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('prop: validationMode=onSubmit', async () => {
      const { user } = await render(
        <Form>
          <Field.Root validate={(val) => (val === 'a' ? 'error' : null)}>
            <Combobox.Root required>
              <Combobox.Input data-testid="input" />
              <Combobox.Clear data-testid="clear" />
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
            </Combobox.Root>
          </Field.Root>
          <button type="submit">submit</button>
        </Form>,
      );

      const input = screen.getByTestId('input');
      expect(input).not.toHaveAttribute('aria-invalid');

      await user.click(screen.getByText('submit'));
      expect(input).toHaveAttribute('aria-invalid', 'true');

      await user.click(input);

      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');

      expect(input).not.toHaveAttribute('aria-invalid');

      const clear = screen.getByTestId('clear');
      await user.click(clear);

      expect(document.activeElement).toBe(input);
      await user.keyboard('{Tab}');

      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    // flaky in real browser
    it.skipIf(!isJSDOM)('prop: validationMode=onChange', async () => {
      const { user } = await render(
        <Field.Root
          validationMode="onChange"
          validate={(value) => {
            return value === '1' ? 'error' : null;
          }}
        >
          <Combobox.Root>
            <Combobox.Input data-testid="input" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    <Combobox.Item value="1">Option 1</Combobox.Item>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        </Field.Root>,
      );

      const input = screen.getByTestId('input');

      expect(input).not.toHaveAttribute('aria-invalid');

      await user.click(input);

      await flushMicrotasks();

      // Arrow Down to focus the Option 1
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');

      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    // flaky in real browser
    it.skipIf(!isJSDOM)('prop: validationMode=onBlur', async () => {
      const { user } = await render(
        <Field.Root
          validationMode="onBlur"
          validate={(value) => {
            return value === '1' ? 'error' : null;
          }}
        >
          <Combobox.Root>
            <Combobox.Input data-testid="input" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    <Combobox.Item value="1">Option 1</Combobox.Item>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
          <Field.Error data-testid="error" />
        </Field.Root>,
      );

      const input = screen.getByTestId('input');

      expect(input).not.toHaveAttribute('aria-invalid');

      await user.click(input);

      await flushMicrotasks();

      // Arrow Down to focus the Option 1
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');

      fireEvent.blur(input);

      await flushMicrotasks();

      await waitFor(() => {
        expect(input).toHaveAttribute('aria-invalid', 'true');
      });
    });

    it('Field.Label', async () => {
      await render(
        <Field.Root>
          <Combobox.Root>
            <Combobox.Input data-testid="input" />
            <Combobox.Portal>
              <Combobox.Positioner />
            </Combobox.Portal>
          </Combobox.Root>
          <Field.Label data-testid="label" nativeLabel={false} render={<span />} />
        </Field.Root>,
      );

      expect(screen.getByTestId('input')).toHaveAttribute(
        'aria-labelledby',
        screen.getByTestId('label').id,
      );
    });

    it('Combobox.Label does not label Combobox.Input and warns when input is the form control', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await render(
        <Combobox.Root>
          <Combobox.Label data-testid="label" />
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner />
          </Combobox.Portal>
        </Combobox.Root>,
      );

      await waitFor(() => {
        expect(errorSpy.mock.calls.length).toBe(1);
      });

      expect(errorSpy.mock.calls[0][0]).toContain(
        'Base UI: <Combobox.Label> labels <Combobox.Trigger> only.',
      );
      expect(screen.getByTestId('input')).not.toHaveAttribute('aria-labelledby');
      errorSpy.mockRestore();
    });

    it('does not set fallback aria-labelledby when no label is rendered', async () => {
      await render(
        <Combobox.Root>
          <Combobox.Input data-testid="input" aria-label="Search" />
          <Combobox.Portal>
            <Combobox.Positioner />
          </Combobox.Portal>
        </Combobox.Root>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('input')).not.toHaveAttribute('aria-labelledby');
      });
    });

    it('updates Combobox.Label linkage when root id changes', async () => {
      const { setProps } = await render(
        <Combobox.Root id="first">
          <Combobox.Label data-testid="label">Food</Combobox.Label>
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Input />
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      await setProps({ id: 'second' });

      /* eslint-disable testing-library/no-wait-for-multiple-assertions */
      await waitFor(() => {
        const label = screen.getByTestId('label');
        const trigger = screen.getByTestId('trigger');
        expect(trigger).toHaveAttribute('id', 'second');
        expect(label.id).toBe('second-label');
        expect(trigger).toHaveAttribute('aria-labelledby', label.id);
      });
      /* eslint-enable testing-library/no-wait-for-multiple-assertions */
    });

    it('Field.Description', async () => {
      await render(
        <Field.Root>
          <Combobox.Root>
            <Combobox.Input data-testid="input" aria-describedby="external-description" />
            <Combobox.Portal>
              <Combobox.Positioner />
            </Combobox.Portal>
          </Combobox.Root>
          <Field.Description data-testid="description" />
        </Field.Root>,
      );

      expect(screen.getByTestId('input')).toHaveAttribute(
        'aria-describedby',
        `external-description ${screen.getByTestId('description').id}`,
      );
    });
  });

  describe('prop: isItemEqualToValue', () => {
    it('matches object values using the provided comparator', async () => {
      const users = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ];

      await render(
        <Combobox.Root
          items={users}
          value={{ id: 2, name: 'Bob' }}
          itemToStringLabel={(item) => item.name}
          itemToStringValue={(item) => String(item.id)}
          isItemEqualToValue={(item, value) => item.id === value.id}
          defaultOpen
        >
          <Combobox.Input data-testid="input" />
          <span data-testid="value">
            <Combobox.Value />
          </span>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item) => (
                    <Combobox.Item key={item.id} value={item}>
                      {item.name}
                    </Combobox.Item>
                  )}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      expect(screen.getByTestId('value')).toHaveTextContent('Bob');
      expect(screen.getByRole('option', { name: 'Bob' })).toHaveAttribute('aria-selected', 'true');
    });

    it('properly deselects object values using the provided comparator', async () => {
      const users = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ];

      await render(
        <Combobox.Root
          items={users}
          defaultValue={[{ id: 2, name: 'Bob' }]}
          itemToStringLabel={(item) => item.name}
          itemToStringValue={(item) => String(item.id)}
          isItemEqualToValue={(item, value) => item.id === value.id}
          defaultOpen
          multiple
        >
          <Combobox.Input data-testid="input" />
          <span data-testid="value">
            <Combobox.Value />
          </span>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item) => (
                    <Combobox.Item key={item.id} value={item}>
                      {item.name}
                    </Combobox.Item>
                  )}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const option = screen.getByRole('option', { name: 'Bob' });

      fireEvent.click(option);

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Bob' })).toHaveAttribute(
          'aria-selected',
          'false',
        );
      });
    });

    it('passes item as the first comparator argument in multiple mode', async () => {
      const users = [
        { id: 1, name: 'Alice', source: 'item' },
        { id: 2, name: 'Bob', source: 'item' },
      ];

      await render(
        <Combobox.Root
          items={users}
          defaultValue={[{ id: 2, name: 'Bob', source: 'selected' }]}
          itemToStringLabel={(item) => item.name}
          itemToStringValue={(item) => String(item.id)}
          isItemEqualToValue={(item, value) =>
            item.id === value.id && item.source === 'item' && value.source === 'selected'
          }
          defaultOpen
          multiple
        >
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item) => (
                    <Combobox.Item key={item.id} value={item}>
                      {item.name}
                    </Combobox.Item>
                  )}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const option = screen.getByRole('option', { name: 'Bob' });
      expect(option).toHaveAttribute('aria-selected', 'true');

      fireEvent.click(option);

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Bob' })).toHaveAttribute(
          'aria-selected',
          'false',
        );
      });
    });

    it('does not call comparator with null when clearing the value', async () => {
      const users = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ];

      const compare = vi.fn((item: any, value: any) => {
        if (value == null) {
          throw new Error('Compared against null');
        }
        return item.id === value.id;
      });

      const hiddenInputRef = React.createRef<HTMLInputElement>();

      const { user } = await render(
        <Combobox.Root
          items={users}
          defaultValue={users[0]}
          itemToStringLabel={(item) => item.name}
          itemToStringValue={(item) => String(item.id)}
          isItemEqualToValue={compare}
          inputRef={hiddenInputRef}
        >
          <Combobox.Trigger>
            <Combobox.Value data-testid="value" />
          </Combobox.Trigger>
          <Combobox.Clear data-testid="clear" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item) => (
                    <Combobox.Item key={item.id} value={item}>
                      {item.name}
                    </Combobox.Item>
                  )}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const clear = await screen.findByTestId('clear');
      await user.click(clear);

      await waitFor(() => {
        expect(hiddenInputRef.current?.value ?? '').toBe('');
      });

      expect(compare.mock.calls.length).toBeGreaterThan(0);
      compare.mock.calls.forEach((call) => {
        expect(call[1]).not.toBe(null);
      });
    });

    it('does not call comparator with undefined when items load asynchronously after opening', async () => {
      interface Country {
        code: string;
        label: string;
      }

      const loadedItems: Country[] = [
        { code: 'ca', label: 'Canada' },
        { code: 'us', label: 'United States' },
      ];

      const compare = vi.fn((item: Country, value: Country) => {
        if (item == null || value == null) {
          throw new Error('Compared against undefined');
        }
        return item.code === value.code;
      });

      const handleInputValueChange = vi.fn();
      const handleValueChange = vi.fn();

      const { user, setProps } = await render(
        <Combobox.Root
          items={undefined}
          value={loadedItems[0]}
          inputValue=""
          onInputValueChange={handleInputValueChange}
          onValueChange={handleValueChange}
          itemToStringLabel={(item: Country) => item.label}
          isItemEqualToValue={compare}
          filter={null}
        >
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: Country) => (
                    <Combobox.Item key={item.code} value={item}>
                      {item.label}
                    </Combobox.Item>
                  )}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByRole('combobox');
      await user.click(input);

      await setProps({ items: loadedItems });

      const canada = await screen.findByRole('option', { name: 'Canada' });
      fireEvent.mouseMove(canada, { pointerType: 'mouse' });
      await waitFor(() => expect(canada).toHaveAttribute('data-highlighted'));
      await user.keyboard('{ArrowDown}');

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'United States' })).toHaveAttribute(
          'data-highlighted',
        );
      });

      expect(compare.mock.calls.length).toBeGreaterThan(0);
      compare.mock.calls.forEach((call) => {
        expect(call[0]).not.toBe(null);
        expect(call[0]).not.toBe(undefined);
        expect(call[1]).not.toBe(null);
        expect(call[1]).not.toBe(undefined);
      });
    });

    it('keeps showing items after selecting in controlled input-inside-popup async load flow', async () => {
      interface Country {
        code: string;
        label: string;
      }

      const loadedItems: Country[] = [
        { code: 'ca', label: 'Canada' },
        { code: 'us', label: 'United States' },
      ];

      function AsyncControlledCombobox(props: { countries: Country[] | undefined }) {
        const { countries } = props;
        const [country, setCountry] = React.useState<Country | null>(null);
        const [inputValue, setInputValue] = React.useState('');

        return (
          <Combobox.Root
            items={countries}
            filter={null}
            value={country}
            inputValue={inputValue}
            onInputValueChange={setInputValue}
            isItemEqualToValue={(item, selected) => item?.code === selected?.code}
            onValueChange={(value) => {
              if (country?.code === value?.code) {
                setCountry(null);
              } else {
                setCountry(value);
              }
            }}
          >
            <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.Input />
                  <Combobox.Empty data-testid="empty">No countries found.</Combobox.Empty>
                  <Combobox.List>
                    {(item: Country) => (
                      <Combobox.Item key={item.code} value={item}>
                        {item.label}
                      </Combobox.Item>
                    )}
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        );
      }

      const { user, setProps } = await render(<AsyncControlledCombobox countries={undefined} />);

      const trigger = screen.getByTestId('trigger');

      await user.click(trigger);
      await setProps({ countries: loadedItems });

      const canada = await screen.findByRole('option', { name: 'Canada' });
      fireEvent.mouseMove(canada, { pointerType: 'mouse' });
      await waitFor(() => expect(canada).toHaveAttribute('data-highlighted'));

      await user.click(canada);
      await waitFor(() => expect(screen.queryByRole('listbox')).toBe(null));

      await user.click(trigger);

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Canada' })).not.toBe(null);
        expect(screen.getByRole('option', { name: 'United States' })).not.toBe(null);
      });
    });
  });

  describe('prop: highlightItemOnHover', () => {
    it('highlights an item on mouse move by default', async () => {
      const { user } = await render(
        <Combobox.Root items={['apple', 'banana', 'cherry']}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: string) => (
                    <Combobox.Item key={item} value={item}>
                      {item}
                    </Combobox.Item>
                  )}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');
      await user.click(input);

      const banana = screen.getByRole('option', { name: 'banana' });
      fireEvent.mouseMove(banana, { pointerType: 'mouse' });

      await waitFor(() => expect(banana).toHaveAttribute('data-highlighted'));
      expect(input.getAttribute('aria-activedescendant')).toBe(banana.id);
    });

    it('does not highlight items from mouse movement when disabled', async () => {
      const { user } = await render(
        <Combobox.Root items={['apple', 'banana', 'cherry']} highlightItemOnHover={false}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: string) => (
                    <Combobox.Item key={item} value={item}>
                      {item}
                    </Combobox.Item>
                  )}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');
      await user.click(input);

      const banana = screen.getByRole('option', { name: 'banana' });
      fireEvent.mouseMove(banana, { pointerType: 'mouse' });

      await waitFor(() => expect(input).not.toHaveAttribute('aria-activedescendant'));
      expect(banana).not.toHaveAttribute('data-highlighted');
    });
  });

  describe('prop: loopFocus', () => {
    it('loops focus from last to first item with ArrowDown by default', async () => {
      const { user } = await render(
        <Combobox.Root items={['apple', 'banana', 'cherry']}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: string) => (
                    <Combobox.Item key={item} value={item}>
                      {item}
                    </Combobox.Item>
                  )}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');
      await act(async () => input.focus());

      // ArrowUp opens and focuses last item
      await user.keyboard('{ArrowUp}');

      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));

      const options = screen.getAllByRole('option');

      await waitFor(() => {
        expect(input).toHaveAttribute('aria-activedescendant', options[2].id);
      });

      // Loop cycles through input
      await user.keyboard('{ArrowDown}');

      await waitFor(() => {
        expect(input).not.toHaveAttribute('aria-activedescendant');
      });

      // Then to first item
      await user.keyboard('{ArrowDown}');

      await waitFor(() => {
        expect(input).toHaveAttribute('aria-activedescendant', options[0].id);
      });
    });

    it('loops focus from first to last item with ArrowUp by default', async () => {
      const { user } = await render(
        <Combobox.Root items={['apple', 'banana', 'cherry']}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: string) => (
                    <Combobox.Item key={item} value={item}>
                      {item}
                    </Combobox.Item>
                  )}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');
      await act(async () => input.focus());

      // ArrowDown opens and focuses first item
      await user.keyboard('{ArrowDown}');

      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));

      const options = screen.getAllByRole('option');

      await waitFor(() => {
        expect(input).toHaveAttribute('aria-activedescendant', options[0].id);
      });

      // Loop cycles through input
      await user.keyboard('{ArrowUp}');

      await waitFor(() => {
        expect(input).not.toHaveAttribute('aria-activedescendant');
      });

      // Then to last item
      await user.keyboard('{ArrowUp}');

      await waitFor(() => {
        expect(input).toHaveAttribute('aria-activedescendant', options[2].id);
      });
    });

    it('does not loop focus from last to first with ArrowDown when loopFocus={false}', async () => {
      const { user } = await render(
        <Combobox.Root items={['apple', 'banana', 'cherry']} loopFocus={false}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: string) => (
                    <Combobox.Item key={item} value={item}>
                      {item}
                    </Combobox.Item>
                  )}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');
      await act(async () => input.focus());

      // ArrowUp opens and focuses last item
      await user.keyboard('{ArrowUp}');

      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));

      const options = screen.getAllByRole('option');

      await waitFor(() => {
        expect(input).toHaveAttribute('aria-activedescendant', options[2].id);
      });

      // Should stay at last item (no loop)
      await user.keyboard('{ArrowDown}');

      await waitFor(() => {
        expect(input).toHaveAttribute('aria-activedescendant', options[2].id);
      });
    });

    it('does not loop focus from first to last with ArrowUp when loopFocus={false}', async () => {
      const { user } = await render(
        <Combobox.Root items={['apple', 'banana', 'cherry']} loopFocus={false}>
          <Combobox.Input data-testid="input" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {(item: string) => (
                    <Combobox.Item key={item} value={item}>
                      {item}
                    </Combobox.Item>
                  )}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByRole<HTMLInputElement>('combobox');
      await act(async () => input.focus());

      // ArrowDown opens and focuses first item
      await user.keyboard('{ArrowDown}');

      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));

      const options = screen.getAllByRole('option');

      await waitFor(() => {
        expect(input).toHaveAttribute('aria-activedescendant', options[0].id);
      });

      // Should stay at first item (no loop)
      await user.keyboard('{ArrowUp}');

      await waitFor(() => {
        expect(input).toHaveAttribute('aria-activedescendant', options[0].id);
      });
    });
  });

  describe('within Composite', () => {
    it('should navigate between combobox and composite items', async () => {
      const { user } = await render(
        <CompositeRoot orientation="horizontal">
          <CompositeItem tag="button">Item 1</CompositeItem>
          <CompositeItem tag="button">Item 2</CompositeItem>
          <Combobox.Root>
            <Combobox.Input render={(props) => <CompositeItem tag="input" props={[props]} />} />
          </Combobox.Root>
        </CompositeRoot>,
      );

      const input = screen.getByRole('combobox');
      await user.click(input);

      await user.keyboard('{ArrowLeft}');
      const button2 = screen.getByRole('button', { name: 'Item 2' });
      expect(button2).toHaveFocus();

      await user.keyboard('{ArrowRight}');
      expect(input).toHaveFocus();
    });
  });
});
