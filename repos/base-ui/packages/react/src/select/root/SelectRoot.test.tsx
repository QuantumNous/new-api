import { expect, vi } from 'vitest';
import * as React from 'react';
import { Select } from '@base-ui/react/select';
import { Popover } from '@base-ui/react/popover';
import {
  act,
  fireEvent,
  flushMicrotasks,
  screen,
  waitFor,
  ignoreActWarnings,
  reactMajor,
} from '@mui/internal-test-utils';
import { createRenderer, isJSDOM, popupConformanceTests, wait } from '#test-utils';
import { Field } from '@base-ui/react/field';
import { Form } from '@base-ui/react/form';

describe('<Select.Root />', () => {
  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  const { render, renderToString } = createRenderer();

  describe('conformance', () => {
    beforeEach(() => {
      ignoreActWarnings();
    });

    popupConformanceTests({
      createComponent: (props) => (
        <Select.Root {...props.root}>
          <Select.Trigger {...props.trigger}>
            <Select.Value />
          </Select.Trigger>
          <Select.Portal {...props.portal}>
            <Select.Positioner>
              <Select.Popup {...props.popup}>
                <Select.Item>Item</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ),
      render,
      triggerMouseAction: 'click',
      expectedPopupRole: 'listbox',
      alwaysMounted: 'only-after-open',
    });
  });

  describe('server-side rendering', () => {
    it('does not link Select.Label before hydration', () => {
      renderToString(
        <Select.Root>
          <Select.Label data-testid="label">Font</Select.Label>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
        </Select.Root>,
      );

      const label = screen.getByTestId('label');
      const trigger = screen.getByTestId('trigger');

      expect(label.id).not.toBe('');
      expect(trigger.id).not.toBe('');
      expect(trigger).not.toHaveAttribute('aria-labelledby');
    });
  });

  describe('prop: defaultValue', () => {
    it('should select the item by default', async () => {
      await render(
        <Select.Root defaultValue="b">
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      const trigger = screen.getByTestId('trigger');

      fireEvent.click(trigger);

      await flushMicrotasks();

      expect(screen.getByRole('option', { name: 'b', hidden: false })).toHaveAttribute(
        'data-selected',
        '',
      );
    });
  });

  describe('prop: value', () => {
    it('should select the item specified by the value prop', async () => {
      await render(
        <Select.Root value="b">
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      const trigger = screen.getByTestId('trigger');

      fireEvent.click(trigger);

      await flushMicrotasks();

      expect(screen.getByRole('option', { name: 'b', hidden: false })).toHaveAttribute(
        'data-selected',
        '',
      );
    });

    it('selects the controlled value when the popup is mounted on the initial render', async () => {
      await render(
        <Select.Root defaultOpen value="b">
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      expect(screen.getByRole('option', { name: 'b', hidden: false })).toHaveAttribute(
        'data-selected',
        '',
      );
      expect(screen.getByRole('option', { name: 'a', hidden: false })).not.toHaveAttribute(
        'data-selected',
      );
    });

    it('should update the selected item when the value prop changes', async () => {
      const { setProps } = await render(
        <Select.Root value="a">
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      const trigger = screen.getByTestId('trigger');

      fireEvent.click(trigger);

      await flushMicrotasks();

      expect(screen.getByRole('option', { name: 'a', hidden: false })).toHaveAttribute(
        'data-selected',
        '',
      );

      await setProps({ value: 'b' });

      expect(screen.getByRole('option', { name: 'b', hidden: false })).toHaveAttribute(
        'data-selected',
        '',
      );
      expect(screen.getByRole('option', { name: 'a', hidden: false })).not.toHaveAttribute(
        'data-selected',
      );
    });

    it('should not update the internal value if the controlled value prop does not change', async () => {
      const onValueChange = vi.fn();
      await render(
        <Select.Root value="a" onValueChange={onValueChange}>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      expect(trigger).toHaveTextContent('a');

      fireEvent.click(trigger);
      await flushMicrotasks();

      const optionB = screen.getByRole('option', { name: 'b' });
      fireEvent.click(optionB);
      await flushMicrotasks();

      expect(onValueChange.mock.calls.length).toBe(0);
      expect(trigger).toHaveTextContent('a');
    });

    it('updates <Select.Value /> label when the value prop changes before the popup opens', async () => {
      const { setProps } = await render(
        <Select.Root value="b">
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      const trigger = screen.getByTestId('trigger');

      expect(trigger).toHaveTextContent('b');

      await setProps({ value: 'a' });
      await flushMicrotasks();

      expect(trigger).toHaveTextContent('a');
    });
  });

  describe('prop: itemToStringValue', () => {
    it('uses itemToStringValue for form submission', async () => {
      const items = [
        { country: 'United States', code: 'US' },
        { country: 'Canada', code: 'CA' },
        { country: 'Australia', code: 'AU' },
      ];

      await render(
        <Select.Root
          name="country"
          defaultValue={items[0]}
          itemToStringLabel={(item) => item.country}
          itemToStringValue={(item) => item.code}
        >
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                {items.map((it) => (
                  <Select.Item key={it.code} value={it}>
                    {it.country}
                  </Select.Item>
                ))}
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      const hiddenInput = screen.getByRole('textbox', {
        hidden: true,
      });
      expect(hiddenInput).toHaveValue('US');
    });

    it('uses itemToStringValue for multiple selection form submission', async () => {
      const items = [
        { country: 'United States', code: 'US' },
        { country: 'Canada', code: 'CA' },
        { country: 'Australia', code: 'AU' },
      ];

      const { container } = await render(
        <Select.Root
          name="countries"
          multiple
          defaultValue={[items[0], items[1]]}
          itemToStringLabel={(item) => item.country}
          itemToStringValue={(item) => item.code}
        >
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                {items.map((it) => (
                  <Select.Item key={it.code} value={it}>
                    {it.country}
                  </Select.Item>
                ))}
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      // eslint-disable-next-line testing-library/no-container -- No appropriate method on screen since it's a type=hidden input
      const hiddenInputs = container.querySelectorAll('input[name="countries"]');
      expect(hiddenInputs).toHaveLength(2);
      expect(hiddenInputs[0]).toHaveValue('US');
      expect(hiddenInputs[1]).toHaveValue('CA');
    });

    it('does not invoke itemToStringValue with the value array in multiple mode', async () => {
      const items = [
        { country: 'United States', code: 'US' },
        { country: 'Canada', code: 'CA' },
      ];

      // A user `itemToStringValue` written for a single item throws if invoked with the whole
      // array. The shared hidden input is nameless in multiple mode, so it must not serialize
      // the array (per-value inputs carry the data). Rendering succeeding is the regression guard.
      const { container } = await render(
        <Select.Root
          name="countries"
          multiple
          defaultValue={[items[0], items[1]]}
          itemToStringValue={(item) => item.code.toUpperCase()}
        >
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                {items.map((it) => (
                  <Select.Item key={it.code} value={it}>
                    {it.country}
                  </Select.Item>
                ))}
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      // eslint-disable-next-line testing-library/no-container -- No appropriate method on screen since it's a type=hidden input
      const hiddenInputs = container.querySelectorAll('input[name="countries"]');
      expect(hiddenInputs).toHaveLength(2);
      expect(hiddenInputs[0]).toHaveValue('US');
      expect(hiddenInputs[1]).toHaveValue('CA');
    });
  });

  describe('prop: itemToStringLabel', () => {
    const items = [
      { country: 'United States', code: 'US' },
      { country: 'Canada', code: 'CA' },
      { country: 'Australia', code: 'AU' },
    ];

    it('uses itemToStringLabel for trigger text when value is object', async () => {
      await render(
        <Select.Root
          defaultValue={items[1]}
          itemToStringLabel={(item) => item.country}
          itemToStringValue={(item) => item.code}
        >
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                {items.map((it) => (
                  <Select.Item key={it.code} value={it}>
                    {it.country}
                  </Select.Item>
                ))}
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      expect(trigger).toHaveTextContent('Canada');
    });

    it('updates trigger text with itemToStringLabel after selecting object item', async () => {
      const { user } = await render(
        <Select.Root
          defaultOpen
          itemToStringLabel={(item: any) => item.country}
          itemToStringValue={(item: any) => item.code}
        >
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                {items.map((it) => (
                  <Select.Item key={it.code} value={it}>
                    {it.country}
                  </Select.Item>
                ))}
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      await user.click(screen.getByRole('option', { name: 'Canada' }));
      expect(screen.getByTestId('trigger')).toHaveTextContent('Canada');
    });
  });

  describe('prop: onValueChange', () => {
    const { render: renderFakeTimers, clock } = createRenderer({
      clockOptions: {
        shouldAdvanceTime: true,
      },
    });

    clock.withFakeTimers();

    it('should call onValueChange when an item is selected', async () => {
      if (reactMajor <= 18) {
        ignoreActWarnings();
      }

      const handleValueChange = vi.fn();

      function App() {
        const [value, setValue] = React.useState<string | null>('');

        return (
          <Select.Root
            value={value}
            onValueChange={(newValue) => {
              setValue(newValue);
              handleValueChange(newValue);
            }}
          >
            <Select.Trigger data-testid="trigger">
              <Select.Value />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Item value="a">a</Select.Item>
                  <Select.Item value="b">b</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        );
      }

      const { user } = await renderFakeTimers(<App />);

      const trigger = screen.getByTestId('trigger');

      await user.click(trigger);
      await flushMicrotasks();

      const option = screen.getByRole('option', { name: 'b' });
      await clock.tickAsync(200);
      await user.click(option);

      expect(handleValueChange.mock.calls[0][0]).toBe('b');
    });

    it('is not called twice on select', async () => {
      if (reactMajor <= 18) {
        ignoreActWarnings();
      }

      const handleValueChange = vi.fn();

      const { user } = await renderFakeTimers(
        <Select.Root onValueChange={handleValueChange}>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      const trigger = screen.getByTestId('trigger');

      await user.click(trigger);
      await flushMicrotasks();

      const option = screen.getByRole('option', { name: 'b' });
      await clock.tickAsync(200);
      await user.click(option);

      expect(handleValueChange.mock.calls.length).toBe(1);
    });
  });

  describe('prop: defaultOpen', () => {
    it('should open the select by default', async () => {
      await render(
        <Select.Root defaultOpen>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      expect(screen.getByRole('listbox', { hidden: false })).toBeVisible();
    });

    it('should select an item and close when clicked while opened by default', async () => {
      const handleValueChange = vi.fn();

      const { user } = await render(
        <Select.Root defaultOpen onValueChange={handleValueChange}>
          <Select.Trigger data-testid="trigger">
            <Select.Value data-testid="value" />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      expect(screen.queryByRole('listbox')).toBeVisible();

      const optionB = screen.getByRole('option', { name: 'b' });

      fireEvent.mouseMove(optionB);
      await user.click(optionB);
      await flushMicrotasks();

      expect(handleValueChange.mock.calls.length).toBe(1);
      expect(handleValueChange.mock.calls[0][0]).toBe('b');

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBe(null);
      });
    });
  });

  describe('prop: onOpenChange', () => {
    it('should call onOpenChange when the select is opened or closed', async () => {
      const handleOpenChange = vi.fn();

      const { user } = await render(
        <Select.Root onOpenChange={handleOpenChange}>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      const trigger = screen.getByTestId('trigger');

      await user.click(trigger);
      await waitFor(() => {
        expect(handleOpenChange.mock.calls.length).toBe(1);
      });
      expect(handleOpenChange.mock.calls[0][0]).toBe(true);
    });
  });

  describe('BaseUIChangeEventDetails', () => {
    it('onOpenChange cancel() prevents opening while uncontrolled', async () => {
      await render(
        <Select.Root
          onOpenChange={(nextOpen, eventDetails) => {
            if (nextOpen) {
              eventDetails.cancel();
            }
          }}
        >
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      fireEvent.click(trigger);
      await flushMicrotasks();

      expect(screen.queryByRole('listbox')).toBe(null);
    });
  });

  it('should handle browser autofill', async () => {
    const { user } = await render(
      <Select.Root name="select">
        <Select.Trigger data-testid="trigger">
          <Select.Value />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              <Select.Item value="a">a</Select.Item>
              <Select.Item value="b">b</Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>,
    );

    const trigger = screen.getByTestId('trigger');

    const selectInput = screen.getByRole('textbox', {
      hidden: true,
    });
    expect(selectInput).toHaveAttribute('name', 'select');
    fireEvent.change(selectInput, { target: { value: 'b' } });
    await flushMicrotasks();

    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'b' })).toHaveAttribute('data-selected', '');
    });
  });

  it('should pass autoComplete to the hidden input', async () => {
    await render(
      <Select.Root name="country" autoComplete="country">
        <Select.Trigger data-testid="trigger">
          <Select.Value />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              <Select.Item value="US">United States</Select.Item>
              <Select.Item value="CA">Canada</Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>,
    );

    const hiddenInput = screen.getByRole('textbox', { hidden: true });
    expect(hiddenInput).toHaveAttribute('name', 'country');
    expect(hiddenInput).toHaveAttribute('autocomplete', 'country');
  });

  it('should handle browser autofill with object values', async () => {
    const items = [
      { country: 'United States', code: 'US' },
      { country: 'Canada', code: 'CA' },
    ];

    const { user } = await render(
      <Select.Root
        name="country"
        itemToStringLabel={(item: any) => item.country}
        itemToStringValue={(item: any) => item.code}
      >
        <Select.Trigger data-testid="trigger">
          <Select.Value />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              {items.map((it) => (
                <Select.Item key={it.code} value={it}>
                  {it.country}
                </Select.Item>
              ))}
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>,
    );

    const trigger = screen.getByTestId('trigger');

    const selectInput = screen.getByRole('textbox', {
      hidden: true,
    });
    expect(selectInput).toHaveAttribute('name', 'country');
    fireEvent.change(selectInput, { target: { value: 'CA' } });
    await flushMicrotasks();

    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Canada', hidden: false })).toHaveAttribute(
        'data-selected',
        '',
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

    const { user } = await render(
      <Select.Root
        name="country"
        itemToStringLabel={(item: any) => item.country}
        itemToStringValue={(item: any) => item.code}
      >
        <Select.Trigger data-testid="trigger">
          <Select.Value />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              {items.map((it) => (
                <Select.Item key={it.code} value={it}>
                  {it.country}
                </Select.Item>
              ))}
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>,
    );

    const trigger = screen.getByTestId('trigger');

    const selectInput = screen.getByRole('textbox', {
      hidden: true,
    });
    expect(selectInput).toHaveAttribute('name', 'country');

    // Simulate browser autofill with the LABEL (displayed text), not the value
    fireEvent.change(selectInput, { target: { value: 'Canada' } }); // Browser sends "Canada" (label), not "CA" (value)
    await flushMicrotasks();

    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Canada', hidden: false })).toHaveAttribute(
        'data-selected',
        '',
      );
    });
  });

  it('matches browser autofill against an item rendered label for primitive values regardless of case', async () => {
    const { user } = await render(
      <Select.Root name="country">
        <Select.Trigger data-testid="trigger">
          <Select.Value />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              <Select.Item value="US">United States</Select.Item>
              <Select.Item value="CA">Canada</Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>,
    );

    const trigger = screen.getByTestId('trigger');
    const selectInput = screen.getByRole('textbox', { hidden: true });

    fireEvent.change(selectInput, { target: { value: 'canada' } });
    await flushMicrotasks();

    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Canada', hidden: false })).toHaveAttribute(
        'data-selected',
        '',
      );
    });
  });

  it('matches browser autofill by serialized value before an earlier rendered label', async () => {
    const { user } = await render(
      <Select.Root name="country">
        <Select.Trigger data-testid="trigger">
          <Select.Value />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              <Select.Item value="CA">US</Select.Item>
              <Select.Item value="US">United States</Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>,
    );

    const trigger = screen.getByTestId('trigger');
    const selectInput = screen.getByRole('textbox', { hidden: true });

    fireEvent.change(selectInput, { target: { value: 'US' } });
    await flushMicrotasks();

    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'United States', hidden: false })).toHaveAttribute(
        'data-selected',
        '',
      );
    });
    expect(screen.getByRole('option', { name: 'US', hidden: false })).not.toHaveAttribute(
      'data-selected',
    );
  });

  it('matches browser autofill when an earlier item has no rendered label', async () => {
    const { user } = await render(
      <Select.Root name="country">
        <Select.Trigger data-testid="trigger">
          <Select.Value />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              <Select.Item value="US">{null}</Select.Item>
              <Select.Item value="CA">Canada</Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>,
    );

    const trigger = screen.getByTestId('trigger');
    const selectInput = screen.getByRole('textbox', { hidden: true });

    fireEvent.change(selectInput, { target: { value: 'Canada' } });
    await flushMicrotasks();

    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Canada', hidden: false })).toHaveAttribute(
        'data-selected',
        '',
      );
    });
  });

  it('marks the field dirty and validates after successful autofill', async () => {
    const validateSpy = vi.fn((value: unknown) => {
      return value === 'CA' ? null : 'error';
    });

    await render(
      <Field.Root validationMode="onChange" validate={validateSpy}>
        <Select.Root name="country">
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="US">United States</Select.Item>
                <Select.Item value="CA">Canada</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      </Field.Root>,
    );

    const trigger = screen.getByTestId('trigger');
    const selectInput = screen.getByRole('textbox', { hidden: true });

    expect(trigger).not.toHaveAttribute('data-dirty');

    fireEvent.change(selectInput, { target: { value: 'CA' } });
    await flushMicrotasks();

    await waitFor(() => {
      expect(validateSpy).toHaveBeenCalled();
    });

    expect(validateSpy.mock.calls[validateSpy.mock.calls.length - 1][0]).toBe('CA');
    expect(trigger).toHaveAttribute('data-dirty', '');
  });

  it('does not update field state when autofill is canceled', async () => {
    await render(
      <Form errors={{ country: 'server error' }}>
        <Field.Root name="country">
          <Select.Root
            onValueChange={(_value, eventDetails) => {
              eventDetails.cancel();
            }}
          >
            <Select.Trigger data-testid="trigger">
              <Select.Value />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Item value="US">United States</Select.Item>
                  <Select.Item value="CA">Canada</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
          <Field.Error data-testid="error" />
        </Field.Root>
      </Form>,
    );

    const trigger = screen.getByTestId('trigger');
    const selectInput = screen.getByRole('textbox', { hidden: true });

    expect(trigger).not.toHaveAttribute('data-dirty');
    expect(screen.getByTestId('error')).toHaveTextContent('server error');

    fireEvent.change(selectInput, { target: { value: 'CA' } });
    await flushMicrotasks();

    expect(trigger).not.toHaveAttribute('data-dirty');
    expect(screen.getByTestId('error')).toHaveTextContent('server error');
  });

  it('removes [data-dirty] in multiple mode after returning to the initial value', async () => {
    const { user } = await render(
      <Field.Root>
        <Select.Root multiple defaultOpen defaultValue={['a']}>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      </Field.Root>,
    );

    const trigger = screen.getByTestId('trigger');
    const optionB = await screen.findByRole('option', { name: 'b' });

    expect(trigger).not.toHaveAttribute('data-dirty');

    await user.click(optionB);

    await waitFor(() => {
      expect(trigger).toHaveAttribute('data-dirty', '');
    });

    await user.click(optionB);

    await waitFor(() => {
      expect(trigger).not.toHaveAttribute('data-dirty');
    });
  });

  it('compares object values with isItemEqualToValue when clearing [data-dirty] in multiple mode', async () => {
    const items = [
      { value: 'a', label: 'a' },
      { value: 'b', label: 'b' },
    ];

    const { user } = await render(
      <Field.Root>
        <Select.Root
          multiple
          defaultOpen
          // A distinct object reference from `items[0]`, but equal to it via `isItemEqualToValue`.
          defaultValue={[{ value: 'a', label: 'a' }]}
          isItemEqualToValue={(a, b) => a.value === b.value}
        >
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value={items[0]}>a</Select.Item>
                <Select.Item value={items[1]}>b</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      </Field.Root>,
    );

    const trigger = screen.getByTestId('trigger');
    const optionA = await screen.findByRole('option', { name: 'a' });

    expect(trigger).not.toHaveAttribute('data-dirty');

    // Deselect the initial item, then reselect it. The reselected value is `items[0]`,
    // a different object reference than the initial `defaultValue` object, so a reference
    // comparison would incorrectly report dirty.
    await user.click(optionA);

    await waitFor(() => {
      expect(trigger).toHaveAttribute('data-dirty', '');
    });

    await user.click(optionA);

    await waitFor(() => {
      expect(trigger).not.toHaveAttribute('data-dirty');
    });
  });

  it('does not invoke isItemEqualToValue with the value array in multiple mode when empty', async () => {
    const items = [
      { value: 'a', label: 'a' },
      { value: 'b', label: 'b' },
    ];

    // A custom `isItemEqualToValue` is written for single items. Before the fix, an empty
    // selection in multiple mode handed the raw `[]` to the comparer (`[]` is non-null, so
    // `compareItemEquality` forwarded it), causing the comparer to run against the array.
    // It must instead be compared against `undefined` (nothing selected), so the comparer
    // is never invoked here. `defaultOpen` ensures the items mount and run the registration
    // effect that used to call the comparer with the raw array.
    const isItemEqualToValue = vi.fn((a: { value: string }, b: { value: string }) => {
      if (Array.isArray(b)) {
        throw new Error('isItemEqualToValue received the value array');
      }
      return a.value === b.value;
    });

    await render(
      <Select.Root multiple defaultOpen defaultValue={[]} isItemEqualToValue={isItemEqualToValue}>
        <Select.Trigger data-testid="trigger">
          <Select.Value />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              <Select.Item value={items[0]}>a</Select.Item>
              <Select.Item value={items[1]}>b</Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>,
    );

    expect(screen.getByTestId('trigger')).not.toBeNull();
    expect(await screen.findAllByRole('option')).toHaveLength(2);
    expect(isItemEqualToValue).not.toHaveBeenCalledWith(expect.anything(), expect.any(Array));
  });

  it('keeps [data-dirty] in multiple mode when the same values return in a different order', async () => {
    const { user } = await render(
      <Field.Root>
        <Select.Root multiple defaultOpen defaultValue={['a', 'b']}>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      </Field.Root>,
    );

    const trigger = screen.getByTestId('trigger');
    const optionA = await screen.findByRole('option', { name: 'a' });

    expect(trigger).not.toHaveAttribute('data-dirty');

    // Deselect `a` (value becomes `['b']`), then reselect it (value becomes `['b', 'a']`).
    // The set of values matches the initial `['a', 'b']`, but the order differs, so the
    // field stays dirty: the comparison is order-sensitive.
    await user.click(optionA);
    await user.click(optionA);

    await waitFor(() => {
      expect(trigger).toHaveAttribute('data-dirty', '');
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
      const select = (
        <Select.Root
          name={withField ? undefined : 'select'}
          readOnly={lockState === 'readOnly'}
          disabled={lockState === 'disabled'}
          onValueChange={onValueChange}
        >
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      );

      await render(
        withField ? (
          <Form errors={{ select: 'test' }}>
            <Field.Root name="select">
              {select}
              <Field.Error data-testid="error" />
            </Field.Root>
          </Form>
        ) : (
          select
        ),
      );

      const selectInput = screen.getByRole<HTMLInputElement>('textbox', { hidden: true });
      expect(selectInput).toHaveAttribute('name', 'select');

      if (withField) {
        expect(screen.getByTestId('error')).toHaveTextContent('test');
      }

      fireEvent.change(selectInput, { target: { value: 'b' } });
      await flushMicrotasks();

      expect(onValueChange).not.toHaveBeenCalled();
      expect(selectInput.value).toBe('');

      if (withField) {
        expect(screen.getByTestId('error')).toHaveTextContent('test');
      }
    },
  );

  it.each(['disabled', 'readOnly'] as const)(
    'does not commit item selection when root is %s and forced open',
    async (lockState) => {
      const onValueChange = vi.fn();
      const { user } = await render(
        <Select.Root
          open
          onValueChange={onValueChange}
          disabled={lockState === 'disabled'}
          readOnly={lockState === 'readOnly'}
        >
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      await user.click(screen.getByRole('option', { name: 'b', hidden: false }));

      expect(onValueChange).not.toHaveBeenCalled();
      expect(screen.getByRole('option', { name: 'b', hidden: false })).not.toHaveAttribute(
        'data-selected',
      );
    },
  );

  describe('prop: modal', () => {
    it('should render an internal backdrop when `true`', async () => {
      const { user } = await render(
        <div>
          <Select.Root modal>
            <Select.Trigger data-testid="trigger">Open</Select.Trigger>
            <Select.Portal>
              <Select.Positioner data-testid="positioner">
                <Select.Popup>
                  <Select.Item>1</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
          <button>Outside</button>
        </div>,
      );

      const trigger = screen.getByTestId('trigger');

      await user.click(trigger);

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBe(null);
      });

      const positioner = screen.getByTestId('positioner');

      expect(positioner.previousElementSibling).toHaveAttribute('role', 'presentation');
    });

    it('should not render an internal backdrop when `false`', async () => {
      const { user } = await render(
        <div>
          <Select.Root modal={false}>
            <Select.Trigger data-testid="trigger">Open</Select.Trigger>
            <Select.Portal>
              <Select.Positioner data-testid="positioner">
                <Select.Popup>
                  <Select.Item>1</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
          <button>Outside</button>
        </div>,
      );

      const trigger = screen.getByTestId('trigger');

      await user.click(trigger);

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBe(null);
      });

      const positioner = screen.getByTestId('positioner');

      expect(positioner.previousElementSibling).toBe(null);
    });
  });

  describe.skipIf(isJSDOM)('scroll locking', () => {
    describe('interaction type tracking (openMethod)', () => {
      it('keeps touch interaction type when reopening quickly after close', async ({
        onTestFinished,
      }) => {
        globalThis.BASE_UI_ANIMATIONS_DISABLED = false;
        let nextFrameId = 0;
        const frameCallbacks = new Map<number, FrameRequestCallback>();

        const requestAnimationFrameSpy = vi
          .spyOn(window, 'requestAnimationFrame')
          .mockImplementation((callback: FrameRequestCallback) => {
            nextFrameId += 1;
            frameCallbacks.set(nextFrameId, callback);
            return nextFrameId;
          });
        const cancelAnimationFrameSpy = vi
          .spyOn(window, 'cancelAnimationFrame')
          .mockImplementation((id: number) => {
            frameCallbacks.delete(id);
          });

        onTestFinished(() => {
          requestAnimationFrameSpy.mockRestore();
          cancelAnimationFrameSpy.mockRestore();
          globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
        });

        const style = `
          @keyframes select-close-test {
            to {
              opacity: 0;
            }
          }

          .animation-test-indicator[data-ending-style] {
            animation: select-close-test 20ms linear;
          }
        `;

        await render(
          <div>
            {/* eslint-disable-next-line react/no-danger */}
            <style dangerouslySetInnerHTML={{ __html: style }} />
            <Select.Root modal>
              <Select.Trigger>Open</Select.Trigger>
              <Select.Portal>
                <Select.Positioner>
                  <Select.Popup className="animation-test-indicator">
                    <Select.Item>Item</Select.Item>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </div>,
        );

        const trigger = screen.getByRole('combobox');

        const isScrollLocked = () =>
          trigger.ownerDocument.documentElement.style.overflow === 'hidden' ||
          trigger.ownerDocument.documentElement.hasAttribute('data-base-ui-scroll-locked') ||
          trigger.ownerDocument.body.style.overflow === 'hidden';

        function fireTouchPress() {
          fireEvent.pointerDown(trigger, { pointerType: 'touch' });
          fireEvent.mouseDown(trigger);
        }

        function flushAnimationFrames() {
          let iterations = 0;
          while (frameCallbacks.size > 0) {
            if (iterations > 20) {
              throw new Error('Exceeded maximum animation frame flush iterations.');
            }

            const pending = Array.from(frameCallbacks.values());
            frameCallbacks.clear();
            pending.forEach((callback) => {
              callback(0);
            });
            iterations += 1;
          }
        }

        fireTouchPress();
        await act(async () => {
          flushAnimationFrames();
        });

        await waitFor(() => {
          expect(screen.queryByRole('listbox')).not.toBe(null);
        });

        fireTouchPress();

        await act(async () => {
          flushAnimationFrames();
        });

        await waitFor(() => {
          expect(trigger).toHaveAttribute('aria-expanded', 'false');
        });

        // Re-open while the previous close animation is still pending.
        fireTouchPress();

        await act(async () => {
          flushAnimationFrames();
        });

        await waitFor(() => {
          expect(screen.queryByRole('listbox')).not.toBe(null);
        });

        await wait(30);

        expect(isScrollLocked()).toBe(false);
      });

      it('keeps touch positioning during the close transition', async ({ onTestFinished }) => {
        globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

        onTestFinished(() => {
          globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
        });

        const style = `
          @keyframes select-close-test {
            to {
              opacity: 0;
            }
          }

          .animation-test-popup[data-ending-style] {
            animation: select-close-test 100ms linear;
          }
        `;

        await render(
          <div style={{ paddingTop: 80 }}>
            {/* eslint-disable-next-line react/no-danger */}
            <style dangerouslySetInnerHTML={{ __html: style }} />
            <Select.Root>
              <Select.Trigger>Open</Select.Trigger>
              <Select.Portal>
                <Select.Positioner>
                  <Select.Popup className="animation-test-popup">
                    <Select.Item>Item</Select.Item>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </div>,
        );

        const trigger = screen.getByRole('combobox');

        function fireTouchPress() {
          fireEvent.pointerDown(trigger, { pointerType: 'touch' });
          fireEvent.mouseDown(trigger);
        }

        fireTouchPress();

        const popup = await screen.findByRole('listbox');
        const positioner = popup.parentElement as HTMLElement;

        expect(getComputedStyle(positioner).position).toBe('absolute');

        fireTouchPress();

        await waitFor(() => {
          expect(popup).toHaveAttribute('data-ending-style');
        });

        expect(getComputedStyle(positioner).position).toBe('absolute');
      });

      it('keeps the selected item highlighted when reopening after a touch-driven mouseleave', async () => {
        await render(
          <Select.Root>
            <Select.Trigger>
              <Select.Value />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Item value="a">a</Select.Item>
                  <Select.Item value="b">b</Select.Item>
                  <Select.Item value="c">c</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>,
        );

        const trigger = screen.getByRole('combobox');

        function fireTouchPress(element: HTMLElement) {
          fireEvent.pointerDown(element, { pointerType: 'touch' });
          fireEvent.mouseDown(element);
        }

        fireTouchPress(trigger);

        await waitFor(() => {
          expect(screen.getByRole('listbox')).toBeInTheDocument();
        });

        const optionB = screen.getByRole('option', { name: 'b' });
        fireEvent.pointerDown(optionB, { pointerType: 'touch' });
        fireEvent.click(optionB);
        fireEvent.mouseLeave(optionB, { clientX: -1, clientY: -1 });

        fireTouchPress(trigger);

        await waitFor(() => {
          expect(screen.getByRole('option', { name: 'b' })).toHaveAttribute('data-highlighted');
        });
      });

      it('recomputes positioning before the popup becomes visible again after touch dismiss', async ({
        onTestFinished,
      }) => {
        globalThis.BASE_UI_ANIMATIONS_DISABLED = false;
        onTestFinished(() => {
          globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
        });

        const onOpenChangeComplete = vi.fn();
        const items = Array.from({ length: 80 }, (_, index) => `Item ${index + 1}`);
        const style = `
          @keyframes select-reopen-test {
            to {
              opacity: 0;
              transform: scale(0.9);
            }
          }

          .reopen-test-popup {
            width: 120px;
            transition:
              transform 150ms,
              opacity 150ms;
          }

          .reopen-test-popup[data-starting-style],
          .reopen-test-popup[data-ending-style] {
            animation: select-reopen-test 20ms linear;
          }

          .reopen-test-list {
            max-height: var(--available-height);
            overflow-y: auto;
          }
        `;

        function Test() {
          const [open, setOpen] = React.useState(false);
          const [paddingTop, setPaddingTop] = React.useState(0);
          const triggerRef = React.useRef<HTMLButtonElement | null>(null);

          React.useLayoutEffect(() => {
            const trigger = triggerRef.current;
            if (!trigger) {
              return;
            }

            const gap =
              document.documentElement.clientHeight - trigger.getBoundingClientRect().bottom;
            if (Math.abs(gap - 100) <= 1) {
              return;
            }

            setPaddingTop((prev) => prev + gap - 100);
          }, [paddingTop]);

          return (
            <div style={{ paddingTop }}>
              {/* eslint-disable-next-line react/no-danger */}
              <style dangerouslySetInnerHTML={{ __html: style }} />
              <button data-testid="outside">Outside</button>
              <Select.Root
                open={open}
                onOpenChange={setOpen}
                onOpenChangeComplete={onOpenChangeComplete}
              >
                <Select.Trigger ref={triggerRef}>Open</Select.Trigger>
                <Select.Portal>
                  <Select.Positioner data-testid="positioner" sideOffset={8}>
                    <Select.Popup className="reopen-test-popup">
                      <Select.ScrollUpArrow />
                      <Select.Arrow />
                      <Select.List className="reopen-test-list">
                        <div aria-hidden style={{ height: 75 }}>
                          Start
                        </div>
                        {items.map((item) => (
                          <Select.Item key={item} value={item}>
                            {item}
                          </Select.Item>
                        ))}
                        <div aria-hidden style={{ height: 75 }}>
                          End
                        </div>
                      </Select.List>
                      <Select.ScrollDownArrow />
                    </Select.Popup>
                  </Select.Positioner>
                </Select.Portal>
              </Select.Root>
            </div>
          );
        }

        const { user } = await render(<Test />);

        const trigger = screen.getByRole('combobox');
        const outside = screen.getByTestId('outside');

        await waitFor(() => {
          const gap =
            document.documentElement.clientHeight - trigger.getBoundingClientRect().bottom;
          expect(Math.abs(gap - 100)).toBeLessThanOrEqual(1);
        });

        function fireTouchPress() {
          fireEvent.pointerDown(trigger, { pointerType: 'touch' });
          fireEvent.mouseDown(trigger);
        }

        fireTouchPress();

        await waitFor(() => {
          expect(screen.queryByRole('listbox')).not.toBe(null);
        });

        const initialPositioner = screen.getByTestId('positioner');

        expect(initialPositioner).toHaveAttribute('data-side', 'top');

        fireEvent.pointerDown(outside, { pointerType: 'touch' });
        fireEvent.mouseDown(outside);

        await waitFor(() => {
          expect(trigger).toHaveAttribute('aria-expanded', 'false');
          expect(onOpenChangeComplete.mock.calls.some(([value]) => value === false)).toBe(true);
          expect(screen.getByTestId('positioner').style.opacity).toBe('0');
        });

        fireTouchPress();

        await waitFor(() => {
          expect(screen.getByTestId('positioner').style.opacity).not.toBe('0');
        });

        const reopenedPositioner = screen.getByTestId('positioner');
        const reopenedList = screen.getByRole('listbox');
        expect(reopenedPositioner).toHaveAttribute('data-side', 'top');
        expect(reopenedList.getBoundingClientRect().height).toBeGreaterThan(200);

        await user.click(outside);
      });
    });

    describe('touch scroll lock', () => {
      it('applies scroll lock when a touch-opened popup covers the viewport width', async () => {
        await render(
          <Select.Root modal>
            <Select.Trigger data-testid="trigger">Open</Select.Trigger>
            <Select.Portal>
              <Select.Positioner data-testid="positioner" style={{ width: 'calc(100vw - 10px)' }}>
                <Select.Popup>
                  <Select.Item>1</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>,
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
          <Select.Root modal>
            <Select.Trigger data-testid="trigger">Open</Select.Trigger>
            <Select.Portal>
              <Select.Positioner data-testid="positioner" style={{ width: '240px' }}>
                <Select.Popup>
                  <Select.Item>1</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>,
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

  describe('prop: actionsRef', () => {
    it('unmounts the select when the `unmount` method is called', async () => {
      const actionsRef = {
        current: {
          unmount: vi.fn(),
        },
      };

      const { user } = await render(
        <Select.Root actionsRef={actionsRef}>
          <Select.Trigger data-testid="trigger">Open</Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item>1</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      await user.click(trigger);

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBe(null);
      });

      await user.click(trigger);

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBe(null);
      });

      await act(async () => {
        await new Promise((resolve) => {
          requestAnimationFrame(resolve);
        });
        actionsRef.current.unmount();
      });

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBe(null);
      });
    });

    it('does not leave a tabbable option while closed and kept mounted after tabbing out', async () => {
      const actionsRef = {
        current: {
          unmount: vi.fn(),
        },
      };

      const { user } = await render(
        <div>
          <input />
          <Select.Root defaultValue="1" modal={false} actionsRef={actionsRef}>
            <Select.Trigger>Open</Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Item value="1">1</Select.Item>
                  <Select.Item value="2">2</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
          <input data-testid="after" />
        </div>,
      );

      const trigger = screen.getByRole('combobox');
      await user.click(trigger);

      const option = await screen.findByRole('option', { name: '1' });
      await act(async () => {
        option.focus();
      });
      await waitFor(() => {
        expect(option).toHaveFocus();
      });
      expect(option).toHaveAttribute('tabindex', '0');

      await user.tab();

      await waitFor(() => {
        expect(screen.getByTestId('after')).toHaveFocus();
      });
      expect(screen.getByRole('listbox')).not.toHaveAttribute('data-open');
      expect(option).toHaveAttribute('tabindex', '-1');
    });
  });

  describe('scroll arrows', () => {
    it('normalizes overlapping fractional scroll ranges when toggling scroll arrow visibility', async () => {
      let scrollTop = 0.4;

      await render(
        <Select.Root open>
          <Select.Trigger>Open</Select.Trigger>
          <Select.Portal>
            <Select.Positioner alignItemWithTrigger={false}>
              <Select.Popup>
                <Select.ScrollUpArrow keepMounted />
                <Select.List
                  ref={(node) => {
                    if (!node) {
                      return;
                    }

                    Object.defineProperty(node, 'scrollTop', {
                      configurable: true,
                      get: () => scrollTop,
                      set: (value: number) => {
                        scrollTop = value;
                      },
                    });
                    Object.defineProperty(node, 'scrollHeight', {
                      value: 60.6,
                      configurable: true,
                    });
                    Object.defineProperty(node, 'clientHeight', {
                      value: 60,
                      configurable: true,
                    });
                  }}
                >
                  <Select.Item value="one">One</Select.Item>
                  <Select.Item value="two">Two</Select.Item>
                  <Select.Item value="three">Three</Select.Item>
                </Select.List>
                <Select.ScrollDownArrow keepMounted />
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      const list = screen.getByRole('listbox');
      const upArrow = screen.getByText('▲');
      const downArrow = screen.getByText('▼');

      await waitFor(() => {
        expect(upArrow).toHaveAttribute('data-visible');
        expect(downArrow).not.toHaveAttribute('data-visible');
      });

      scrollTop = 0.2;
      fireEvent.scroll(list);

      await waitFor(() => {
        expect(upArrow).not.toHaveAttribute('data-visible');
        expect(downArrow).toHaveAttribute('data-visible');
      });
    });

    it.skipIf(isJSDOM)(
      'keeps a scroll arrow mounted while its exit animation runs',
      async ({ onTestFinished }) => {
        globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

        onTestFinished(() => {
          globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
        });

        let scrollTop = 0;

        const style = `
          @keyframes select-scroll-arrow-close-test {
            to {
              opacity: 0;
            }
          }

          .animation-test-scroll-arrow[data-ending-style] {
            animation: select-scroll-arrow-close-test 100ms linear;
          }
        `;

        await render(
          <div>
            {/* eslint-disable-next-line react/no-danger */}
            <style dangerouslySetInnerHTML={{ __html: style }} />
            <Select.Root open>
              <Select.Trigger>Open</Select.Trigger>
              <Select.Portal>
                <Select.Positioner alignItemWithTrigger={false}>
                  <Select.Popup>
                    <Select.List
                      ref={(node) => {
                        if (!node) {
                          return;
                        }

                        Object.defineProperty(node, 'scrollTop', {
                          configurable: true,
                          get: () => scrollTop,
                          set: (value: number) => {
                            scrollTop = value;
                          },
                        });
                        Object.defineProperty(node, 'scrollHeight', {
                          value: 100,
                          configurable: true,
                        });
                        Object.defineProperty(node, 'clientHeight', {
                          value: 60,
                          configurable: true,
                        });
                      }}
                    >
                      <Select.Item value="one">One</Select.Item>
                      <Select.Item value="two">Two</Select.Item>
                      <Select.Item value="three">Three</Select.Item>
                    </Select.List>
                    <Select.ScrollDownArrow
                      className="animation-test-scroll-arrow"
                      data-testid="scroll-arrow"
                    />
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </div>,
        );

        const list = screen.getByRole('listbox');

        await waitFor(() => {
          expect(screen.getByTestId('scroll-arrow')).toHaveAttribute('data-visible');
        });

        scrollTop = 40;
        fireEvent.scroll(list);

        await waitFor(() => {
          expect(screen.getByTestId('scroll-arrow')).toHaveAttribute('data-ending-style');
        });

        await waitFor(() => {
          expect(screen.queryByTestId('scroll-arrow')).toBe(null);
        });
      },
    );
  });

  describe.skipIf(isJSDOM)('select inside popover', () => {
    async function fireHeldPress(target: Element) {
      fireEvent.pointerDown(target, {
        button: 0,
        buttons: 1,
        pointerType: 'mouse',
      });
      fireEvent.mouseDown(target, {
        button: 0,
        buttons: 1,
      });

      await wait(50);

      fireEvent.pointerUp(target, {
        button: 0,
        buttons: 0,
        pointerType: 'mouse',
      });
      fireEvent.mouseUp(target, {
        button: 0,
        buttons: 0,
      });
      fireEvent.click(target, {
        button: 0,
      });
    }

    it('dismisses the popover with one outside press after reopening an aligned select', async () => {
      const { user } = await render(
        <div>
          <Popover.Root defaultOpen>
            <Popover.Trigger>Open popover</Popover.Trigger>
            <Popover.Portal>
              <Popover.Positioner>
                <Popover.Popup data-testid="popover-popup">
                  <Select.Root defaultValue="gala">
                    <Select.Trigger data-testid="select-trigger">
                      <Select.Value placeholder="Pick one" />
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Positioner alignItemWithTrigger>
                        <Select.Popup>
                          <Select.Item value="gala">Gala</Select.Item>
                          <Select.Item value="fuji">Fuji</Select.Item>
                        </Select.Popup>
                      </Select.Positioner>
                    </Select.Portal>
                  </Select.Root>
                </Popover.Popup>
              </Popover.Positioner>
            </Popover.Portal>
          </Popover.Root>
        </div>,
      );

      await user.pointer({ keys: '[MouseLeft>]', target: screen.getByTestId('select-trigger') });
      await user.pointer({
        keys: '[/MouseLeft]',
        target: await screen.findByRole('option', { name: 'Gala' }),
      });
      await user.click(await screen.findByRole('option', { name: 'Fuji' }));

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBe(null);
      });

      expect(screen.queryByTestId('popover-popup')).not.toBe(null);

      await fireHeldPress(document.body);

      await waitFor(() => {
        expect(screen.queryByTestId('popover-popup')).toBe(null);
      });
    });

    it('dismisses the popover after reopening a selected aligned select', async () => {
      ignoreActWarnings();

      const { user } = await render(
        <Popover.Root>
          <Popover.Trigger>Open popover</Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup data-testid="popover-popup" initialFocus={false}>
                <Select.Root>
                  <Select.Label>Apple</Select.Label>
                  <Select.Trigger data-testid="select-trigger">
                    <Select.Value placeholder="Select apple" />
                  </Select.Trigger>
                  <Select.Portal>
                    <Select.Positioner sideOffset={8}>
                      <Select.Popup>
                        <Select.ScrollUpArrow />
                        <Select.List>
                          <Select.Item value="gala">Gala</Select.Item>
                          <Select.Item value="fuji">Fuji</Select.Item>
                          <Select.Item value="honeycrisp">Honeycrisp</Select.Item>
                        </Select.List>
                        <Select.ScrollDownArrow />
                      </Select.Popup>
                    </Select.Positioner>
                  </Select.Portal>
                </Select.Root>
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>,
      );

      await user.click(screen.getByRole('button', { name: 'Open popover' }));
      await screen.findByTestId('popover-popup');

      await user.click(screen.getByTestId('select-trigger'));
      await user.click(await screen.findByRole('option', { name: 'Gala' }));

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBe(null);
      });

      await user.pointer({ keys: '[MouseLeft>]', target: screen.getByTestId('select-trigger') });
      const selectedOption = await screen.findByRole('option', { name: 'Gala' });
      await user.pointer({ keys: '[/MouseLeft]', target: selectedOption });

      await user.click(await screen.findByRole('option', { name: 'Fuji' }));

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBe(null);
      });

      await fireHeldPress(document.body);

      await waitFor(() => {
        expect(screen.queryByTestId('popover-popup')).toBe(null);
      });
    });

    it('keeps a modal popover open when choosing a non-modal aligned select item', async () => {
      const { user } = await render(
        <Popover.Root defaultOpen modal>
          <Popover.Trigger>Open popover</Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup data-testid="popover-popup">
                <Select.Root modal={false}>
                  <Select.Trigger data-testid="select-trigger">
                    <Select.Value placeholder="Pick one" />
                  </Select.Trigger>
                  <Select.Portal>
                    <Select.Positioner alignItemWithTrigger>
                      <Select.Popup>
                        <Select.Item value="one">One</Select.Item>
                        <Select.Item value="two">Two</Select.Item>
                      </Select.Popup>
                    </Select.Positioner>
                  </Select.Portal>
                </Select.Root>
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>,
      );

      await user.click(screen.getByTestId('select-trigger'));
      await screen.findByRole('listbox');

      await user.click(screen.getByRole('option', { name: 'Two' }));

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBe(null);
      });
      expect(screen.queryByTestId('popover-popup')).not.toBe(null);
    });

    it('does not bubble Escape from a non-modal select to the popover', async () => {
      const { user } = await render(
        <Popover.Root defaultOpen>
          <Popover.Trigger>Open popover</Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup data-testid="popover-popup">
                <Select.Root modal={false}>
                  <Select.Trigger data-testid="select-trigger">
                    <Select.Value placeholder="Pick one" />
                  </Select.Trigger>
                  <Select.Portal>
                    <Select.Positioner>
                      <Select.Popup>
                        <Select.Item value="one">One</Select.Item>
                        <Select.Item value="two">Two</Select.Item>
                      </Select.Popup>
                    </Select.Positioner>
                  </Select.Portal>
                </Select.Root>
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>,
      );

      await user.click(screen.getByTestId('select-trigger'));
      await screen.findByRole('listbox');

      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBe(null);
      });
      expect(screen.queryByTestId('popover-popup')).not.toBe(null);
    });

    it('returns focus to the opener when a select is opened programmatically inside a popover', async () => {
      function Test() {
        const [selectOpen, setSelectOpen] = React.useState(false);

        return (
          <Popover.Root defaultOpen>
            <Popover.Trigger>Open popover</Popover.Trigger>
            <Popover.Portal>
              <Popover.Positioner>
                <Popover.Popup data-testid="popover-popup">
                  <button type="button" onClick={() => setSelectOpen(true)}>
                    Open select programmatically
                  </button>
                  <Select.Root open={selectOpen} onOpenChange={setSelectOpen}>
                    <Select.Trigger data-testid="select-trigger">
                      <Select.Value placeholder="Pick one" />
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Positioner>
                        <Select.Popup>
                          <Select.Item value="one">One</Select.Item>
                          <Select.Item value="two">Two</Select.Item>
                        </Select.Popup>
                      </Select.Positioner>
                    </Select.Portal>
                  </Select.Root>
                </Popover.Popup>
              </Popover.Positioner>
            </Popover.Portal>
          </Popover.Root>
        );
      }

      const { user } = await render(<Test />);

      const selectOpener = screen.getByRole('button', {
        name: 'Open select programmatically',
      });
      await user.click(selectOpener);

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBe(null);
      });

      await user.click(screen.getByRole('option', { name: 'Two' }));

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBe(null);
      });
      expect(selectOpener).toHaveFocus();
      expect(screen.queryByTestId('popover-popup')).not.toBe(null);
    });

    it('does not consume the next outside press after a native drag from a modal select trigger outside all popups', async () => {
      ignoreActWarnings();

      await render(
        <Popover.Root defaultOpen>
          <Popover.Trigger>Open popover</Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup data-testid="popover-popup">
                <Select.Root>
                  <Select.Trigger data-testid="select-trigger">
                    <Select.Value placeholder="Pick one" />
                  </Select.Trigger>
                  <Select.Portal>
                    <Select.Positioner alignItemWithTrigger>
                      <Select.Popup>
                        <Select.Item value="one">One</Select.Item>
                        <Select.Item value="two">Two</Select.Item>
                      </Select.Popup>
                    </Select.Positioner>
                  </Select.Portal>
                </Select.Root>
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>,
      );

      const selectTrigger = screen.getByTestId('select-trigger');
      const rect = selectTrigger.getBoundingClientRect();
      const startX = rect.left + rect.width / 2;
      const startY = rect.top + rect.height / 2;

      fireEvent.pointerDown(selectTrigger, {
        button: 0,
        buttons: 1,
        clientX: startX,
        clientY: startY,
        pointerType: 'mouse',
      });
      fireEvent.mouseDown(selectTrigger, {
        button: 0,
        buttons: 1,
        clientX: startX,
        clientY: startY,
      });

      await screen.findByRole('listbox');

      const endX = 400;
      const endY = 20;
      const endTarget = document.elementFromPoint(endX, endY) as Element;

      fireEvent.pointerMove(endTarget, {
        button: 0,
        buttons: 1,
        clientX: endX,
        clientY: endY,
        pointerType: 'mouse',
      });
      fireEvent.mouseMove(endTarget, {
        button: 0,
        buttons: 1,
        clientX: endX,
        clientY: endY,
      });
      fireEvent.pointerUp(endTarget, {
        button: 0,
        buttons: 0,
        clientX: endX,
        clientY: endY,
        pointerType: 'mouse',
      });
      fireEvent.mouseUp(endTarget, {
        button: 0,
        buttons: 0,
        clientX: endX,
        clientY: endY,
      });

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBe(null);
      });
      expect(screen.queryByTestId('popover-popup')).not.toBe(null);

      fireEvent.pointerDown(document.body, {
        button: 0,
        buttons: 1,
        clientX: endX,
        clientY: endY,
        pointerType: 'mouse',
      });
      fireEvent.mouseDown(document.body, {
        button: 0,
        buttons: 1,
        clientX: endX,
        clientY: endY,
      });
      fireEvent.pointerUp(document.body, {
        button: 0,
        buttons: 0,
        clientX: endX,
        clientY: endY,
        pointerType: 'mouse',
      });
      fireEvent.mouseUp(document.body, {
        button: 0,
        buttons: 0,
        clientX: endX,
        clientY: endY,
      });
      fireEvent.click(document.body, {
        button: 0,
        clientX: endX,
        clientY: endY,
      });

      await waitFor(() => {
        expect(screen.queryByTestId('popover-popup')).toBe(null);
      });
    });
  });

  describe.skipIf(isJSDOM)('prop: onOpenChangeComplete', () => {
    it('is called on close when there is no exit animation defined', async () => {
      const onOpenChangeComplete = vi.fn();

      function Test() {
        const [open, setOpen] = React.useState(true);
        return (
          <div>
            <button onClick={() => setOpen(false)}>Close</button>
            <Select.Root open={open} onOpenChangeComplete={onOpenChangeComplete}>
              <Select.Portal>
                <Select.Positioner>
                  <Select.Popup data-testid="popup" />
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </div>
        );
      }

      const { user } = await render(<Test />);

      const closeButton = screen.getByText('Close');
      await user.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBe(null);
      });

      expect(onOpenChangeComplete.mock.calls[0][0]).toBe(true);
      expect(onOpenChangeComplete.mock.lastCall?.[0]).toBe(false);
    });

    it('is called on close when the exit animation finishes', async () => {
      globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

      const onOpenChangeComplete = vi.fn();

      function Test() {
        const style = `
          @keyframes test-anim {
            to {
              opacity: 0;
            }
          }

          .animation-test-indicator[data-ending-style] {
            animation: test-anim 1ms;
          }
        `;

        const [open, setOpen] = React.useState(true);

        return (
          <div>
            {/* eslint-disable-next-line react/no-danger */}
            <style dangerouslySetInnerHTML={{ __html: style }} />
            <button onClick={() => setOpen(false)}>Close</button>
            <Select.Root open={open} onOpenChangeComplete={onOpenChangeComplete}>
              <Select.Portal>
                <Select.Positioner>
                  <Select.Popup className="animation-test-indicator" data-testid="popup" />
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </div>
        );
      }

      const { user } = await render(<Test />);

      expect(screen.queryByRole('listbox')).not.toBe(null);

      // Wait for open animation to finish
      await waitFor(() => {
        expect(onOpenChangeComplete.mock.calls[0][0]).toBe(true);
      });

      const closeButton = screen.getByText('Close');
      await user.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBe(null);
      });

      expect(onOpenChangeComplete.mock.lastCall?.[0]).toBe(false);
    });

    it('is called on open when there is no enter animation defined', async () => {
      const onOpenChangeComplete = vi.fn();

      function Test() {
        const [open, setOpen] = React.useState(false);
        return (
          <div>
            <button onClick={() => setOpen(true)}>Open</button>
            <Select.Root open={open} onOpenChangeComplete={onOpenChangeComplete}>
              <Select.Portal>
                <Select.Positioner>
                  <Select.Popup data-testid="popup" />
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </div>
        );
      }

      const { user } = await render(<Test />);

      const openButton = screen.getByText('Open');
      await user.click(openButton);

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBe(null);
      });

      expect(onOpenChangeComplete.mock.calls.length).toBe(2); // 1 in browser
      expect(onOpenChangeComplete.mock.calls[0][0]).toBe(true);
    });

    it('is called on open when the enter animation finishes', async () => {
      globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

      const onOpenChangeComplete = vi.fn();

      function Test() {
        const style = `
          @keyframes test-anim {
            from {
              opacity: 0;
            }
          }

          .animation-test-indicator[data-starting-style] {
            animation: test-anim 1ms;
          }
        `;

        const [open, setOpen] = React.useState(false);

        return (
          <div>
            {/* eslint-disable-next-line react/no-danger */}
            <style dangerouslySetInnerHTML={{ __html: style }} />
            <button onClick={() => setOpen(true)}>Open</button>
            <Select.Root
              open={open}
              onOpenChange={setOpen}
              onOpenChangeComplete={onOpenChangeComplete}
            >
              <Select.Portal>
                <Select.Positioner>
                  <Select.Popup className="animation-test-indicator" data-testid="popup" />
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </div>
        );
      }

      const { user } = await render(<Test />);

      const openButton = screen.getByText('Open');
      await user.click(openButton);

      // Wait for open animation to finish
      await waitFor(() => {
        expect(onOpenChangeComplete.mock.calls[0][0]).toBe(true);
      });

      expect(screen.queryByRole('listbox')).not.toBe(null);
    });

    it('does not get called on mount when not open', async () => {
      const onOpenChangeComplete = vi.fn();

      await render(
        <Select.Root onOpenChangeComplete={onOpenChangeComplete}>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup data-testid="popup" />
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      expect(onOpenChangeComplete.mock.calls.length).toBe(0);
    });
  });

  describe('prop: disabled', () => {
    it('sets the disabled state', async () => {
      const handleOpenChange = vi.fn();
      const { user } = await render(
        <Select.Root defaultValue="b" onOpenChange={handleOpenChange} disabled>
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      const trigger = screen.getByRole('combobox');
      expect(trigger).toHaveAttribute('disabled');
      expect(trigger).toHaveAttribute('data-disabled');

      await user.keyboard('[Tab]');

      expect(expect(document.activeElement)).not.toBe(trigger);

      await user.click(trigger);
      expect(handleOpenChange.mock.calls.length).toBe(0);
    });

    it('updates the disabled state when the disabled prop changes', async () => {
      const handleOpenChange = vi.fn();
      function App() {
        const [disabled, setDisabled] = React.useState(true);
        return (
          <React.Fragment>
            <button onClick={() => setDisabled(!disabled)}>toggle</button>
            <Select.Root defaultValue="b" onOpenChange={handleOpenChange} disabled={disabled}>
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Portal>
                <Select.Positioner>
                  <Select.Popup>
                    <Select.Item value="a">a</Select.Item>
                    <Select.Item value="b">b</Select.Item>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </React.Fragment>
        );
      }
      const { user } = await render(<App />);

      const trigger = screen.getByRole('combobox');
      expect(trigger).toHaveAttribute('disabled');
      expect(trigger).toHaveAttribute('data-disabled');

      await user.keyboard('[Tab]');

      expect(expect(document.activeElement)).not.toBe(trigger);

      await user.click(trigger);
      expect(handleOpenChange.mock.calls.length).toBe(0);

      await user.click(screen.getByRole('button', { name: 'toggle' }));

      expect(trigger).not.toHaveAttribute('disabled');
      expect(trigger).not.toHaveAttribute('data-disabled');

      await user.keyboard('[Tab]');
      expect(trigger).toHaveFocus();

      await user.click(trigger);
      await waitFor(() => {
        expect(handleOpenChange.mock.calls.length).toBe(1);
      });
    });
  });

  describe('prop: readOnly', () => {
    it('sets the readOnly state', async () => {
      const handleOpenChange = vi.fn();
      const { user } = await render(
        <Select.Root defaultValue="b" onOpenChange={handleOpenChange} readOnly>
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
        </Select.Root>,
      );

      const trigger = screen.getByRole('combobox');
      expect(trigger).toHaveAttribute('aria-readonly', 'true');
      expect(trigger).toHaveAttribute('data-readonly');

      await user.keyboard('[Tab]');
      expect(trigger).toHaveFocus();

      await user.click(trigger);
      expect(handleOpenChange.mock.calls.length).toBe(0);
    });

    it('should not open the select when clicked', async () => {
      const handleOpenChange = vi.fn();
      const { user } = await render(
        <Select.Root onOpenChange={handleOpenChange} readOnly>
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
        </Select.Root>,
      );

      const trigger = screen.getByRole('combobox');

      await user.click(trigger);
      expect(screen.queryByRole('listbox')).toBe(null);
      expect(handleOpenChange.mock.calls.length).toBe(0);
    });

    it('should not open the select when using keyboard', async () => {
      const handleOpenChange = vi.fn();
      const { user } = await render(
        <Select.Root onOpenChange={handleOpenChange} readOnly>
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
        </Select.Root>,
      );

      const trigger = screen.getByRole('combobox');

      await act(async () => {
        trigger.focus();
      });

      expect(screen.queryByRole('listbox')).toBe(null);
      expect(document.activeElement).toBe(trigger);

      await user.keyboard('[ArrowDown]');
      expect(screen.queryByRole('listbox')).toBe(null);
      expect(handleOpenChange.mock.calls.length).toBe(0);

      await user.keyboard('[Enter]');
      expect(screen.queryByRole('listbox')).toBe(null);
      expect(handleOpenChange.mock.calls.length).toBe(0);

      await user.keyboard('[Space]');
      expect(screen.queryByRole('listbox')).toBe(null);
      expect(handleOpenChange.mock.calls.length).toBe(0);
    });
  });

  describe('prop: id', () => {
    it('sets the id on the trigger', async () => {
      await render(
        <Select.Root id="test-id">
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      const trigger = screen.getByRole('combobox');
      expect(trigger).toHaveAttribute('id', 'test-id');
    });

    it('sets a hidden input id when name is not provided', async () => {
      await render(
        <Select.Root id="test-id">
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
        </Select.Root>,
      );

      const hiddenInput = screen.getByRole('textbox', { hidden: true });
      expect(hiddenInput).toHaveAttribute('id', 'test-id-hidden-input');
      expect(hiddenInput).not.toHaveAttribute('name');
    });

    it('does not set a hidden input id when name is provided', async () => {
      await render(
        <Select.Root id="test-id" name="country">
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
        </Select.Root>,
      );

      const hiddenInput = screen.getByRole('textbox', { hidden: true });
      expect(hiddenInput).toHaveAttribute('name', 'country');
      expect(hiddenInput).not.toHaveAttribute('id');
    });
  });

  describe('with Field.Root parent', () => {
    it('should receive disabled prop from Field.Root', async () => {
      await render(
        <Field.Root disabled>
          <Select.Root>
            <Select.Trigger data-testid="trigger">
              <Select.Value />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Item value="a">a</Select.Item>
                  <Select.Item value="b">b</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        </Field.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      expect(trigger).toHaveAttribute('disabled');
    });

    it('should receive name prop from Field.Root', async () => {
      await render(
        <Field.Root name="field-select">
          <Select.Root>
            <Select.Trigger data-testid="trigger">
              <Select.Value />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Item value="a">a</Select.Item>
                  <Select.Item value="b">b</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        </Field.Root>,
      );

      const hiddenInput = screen.getByRole('textbox', { hidden: true });
      expect(hiddenInput).toHaveAttribute('name', 'field-select');
    });
  });

  it('resets selected index when value is set to null without a null item', async () => {
    function App() {
      const [value, setValue] = React.useState<string | null>(null);
      return (
        <div>
          <button onClick={() => setValue('1')}>1</button>
          <button onClick={() => setValue('2')}>2</button>
          <button onClick={() => setValue(null)}>null</button>
          <Select.Root value={value} onValueChange={setValue}>
            <Select.Trigger data-testid="trigger">
              <Select.Value data-testid="value">{(val) => val ?? 'initial'}</Select.Value>
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Item value="1">1</Select.Item>
                  <Select.Item value="2">2</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        </div>
      );
    }

    const { user } = await render(<App />);

    await user.click(screen.getByText('initial'));

    await user.click(screen.getByRole('button', { name: '1' }));
    expect(screen.getByTestId('value')).toHaveTextContent('1');

    await user.click(screen.getByRole('button', { name: '2' }));
    expect(screen.getByTestId('value')).toHaveTextContent('2');

    await user.click(screen.getByRole('button', { name: 'null' }));
    expect(screen.getByTestId('value')).toHaveTextContent('initial');

    await user.click(screen.getByTestId('trigger'));
    await waitFor(() => {
      expect(screen.queryByRole('option', { name: '2' })).not.toHaveAttribute('data-selected', '');
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
            <Select.Root
              defaultValue={items[0]}
              itemToStringLabel={(item) => item.label}
              itemToStringValue={(item) => item.code}
            >
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Portal>
                <Select.Positioner>
                  <Select.Popup>
                    <Select.Item value={items[0]}>United States</Select.Item>
                    <Select.Item value={items[1]}>Canada</Select.Item>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
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

      await render(
        <React.Fragment>
          <form id="external-form" onSubmit={submitSpy}>
            <button type="submit">Submit</button>
          </form>
          <Select.Root name="country" form="external-form" defaultValue="US">
            <Select.Trigger>
              <Select.Value />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Item value="US">United States</Select.Item>
                  <Select.Item value="CA">Canada</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        </React.Fragment>,
      );

      fireEvent.click(screen.getByText('Submit'));

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

        await render(
          <React.Fragment>
            <form id="external-form" onSubmit={submitSpy}>
              <button type="submit">Submit</button>
            </form>
            <Select.Root multiple name="countries" form="external-form" value={['US', 'CA']}>
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Portal>
                <Select.Positioner>
                  <Select.Popup>
                    <Select.Item value="US">United States</Select.Item>
                    <Select.Item value="CA">Canada</Select.Item>
                    <Select.Item value="AU">Australia</Select.Item>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </React.Fragment>,
        );

        fireEvent.click(screen.getByText('Submit'));

        expect(submitSpy.mock.calls.length).toBe(1);
        expect(submitSpy.mock.results.at(-1)?.value).toEqual(['US', 'CA']);
      },
    );

    it('triggers native HTML validation on submit', async () => {
      const { user } = await render(
        <Form>
          <Field.Root name="test" data-testid="field">
            <Select.Root required>
              <Select.Trigger data-testid="trigger">
                <Select.Value />
              </Select.Trigger>
              <Select.Portal>
                <Select.Positioner />
              </Select.Portal>
            </Select.Root>
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

    it('clears external errors on change', async () => {
      ignoreActWarnings();

      const { user } = await renderFakeTimers(
        <Form
          errors={{
            select: 'test',
          }}
        >
          <Field.Root name="select">
            <Select.Root>
              <Select.Trigger data-testid="trigger">
                <Select.Value />
              </Select.Trigger>
              <Select.Portal>
                <Select.Positioner>
                  <Select.Popup>
                    <Select.Item value="a">a</Select.Item>
                    <Select.Item value="b">b</Select.Item>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
            <Field.Error data-testid="error" />
          </Field.Root>
        </Form>,
      );

      expect(screen.getByTestId('error')).toHaveTextContent('test');

      const trigger = screen.getByTestId('trigger');
      expect(trigger).toHaveAttribute('aria-invalid', 'true');

      await user.click(trigger);
      await flushMicrotasks();

      const option = screen.getByRole('option', { name: 'b' });
      await clock.tickAsync(200);
      await user.click(option);

      expect(screen.queryByTestId('error')).toBe(null);
      expect(trigger).not.toHaveAttribute('aria-invalid');
    });

    it('revalidates immediately after form submission errors', async () => {
      ignoreActWarnings();

      const { user } = await renderFakeTimers(
        <Form>
          <Field.Root name="select">
            <Select.Root required>
              <Select.Trigger data-testid="trigger">
                <Select.Value />
              </Select.Trigger>
              <Select.Portal>
                <Select.Positioner>
                  <Select.Popup>
                    <Select.Item value="a">a</Select.Item>
                    <Select.Item value="b">b</Select.Item>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
            <Field.Error match="valueMissing" data-testid="error">
              required
            </Field.Error>
          </Field.Root>
          <button type="submit" data-testid="submit">
            Submit
          </button>
        </Form>,
      );

      const submit = screen.getByTestId('submit');
      await user.click(submit);

      expect(screen.getByTestId('error')).toHaveTextContent('required');
      const trigger = screen.getByTestId('trigger');
      expect(trigger).toHaveAttribute('aria-invalid', 'true');

      await user.click(trigger);
      await flushMicrotasks();
      await clock.tickAsync(200);
      await user.click(screen.getByRole('option', { name: 'b' }));

      expect(screen.queryByTestId('error')).toBe(null);
      expect(trigger).not.toHaveAttribute('aria-invalid');
    });
  });

  describe('Field', () => {
    const { render: renderFakeTimers, clock } = createRenderer({
      clockOptions: {
        shouldAdvanceTime: true,
      },
    });

    clock.withFakeTimers();

    it('[data-touched]', async () => {
      await render(
        <Field.Root>
          <Select.Root>
            <Select.Trigger data-testid="trigger" />
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Item value="">Select</Select.Item>
                  <Select.Item value="1">Option 1</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        </Field.Root>,
      );

      const trigger = screen.getByTestId('trigger');

      expect(trigger).not.toHaveAttribute('data-dirty');

      fireEvent.focus(trigger);
      fireEvent.blur(trigger);

      await flushMicrotasks();

      expect(trigger).toHaveAttribute('data-touched', '');
    });

    it('[data-dirty]', async () => {
      ignoreActWarnings();

      const { user } = await renderFakeTimers(
        <Field.Root>
          <Select.Root>
            <Select.Trigger data-testid="trigger" />
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Item value="">Select</Select.Item>
                  <Select.Item value="1">Option 1</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        </Field.Root>,
      );

      const trigger = screen.getByTestId('trigger');

      expect(trigger).not.toHaveAttribute('data-dirty');

      await user.click(trigger);
      await flushMicrotasks();
      await clock.tickAsync(200);

      const option = screen.getByRole('option', { name: 'Option 1' });

      // Arrow Down to focus the Option 1
      await user.keyboard('{ArrowDown}');
      await user.click(option);
      await flushMicrotasks();

      expect(trigger).toHaveAttribute('data-dirty', '');
    });

    describe('[data-filled]', () => {
      it('adds [data-filled] attribute when filled', async () => {
        ignoreActWarnings();

        const { user } = await renderFakeTimers(
          <Field.Root>
            <Select.Root>
              <Select.Trigger data-testid="trigger" />
              <Select.Portal>
                <Select.Positioner>
                  <Select.Popup>
                    <Select.Item value="">Select</Select.Item>
                    <Select.Item value="1">Option 1</Select.Item>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </Field.Root>,
        );

        const trigger = screen.getByTestId('trigger');

        expect(trigger).not.toHaveAttribute('data-filled');

        await user.click(trigger);
        await flushMicrotasks();
        await clock.tickAsync(200);

        const option = screen.getByRole('option', { name: 'Option 1' });

        // Arrow Down to focus the Option 1
        await user.keyboard('{ArrowDown}');
        await user.click(option);
        await flushMicrotasks();

        expect(trigger).toHaveAttribute('data-filled', '');

        await user.click(trigger);

        await flushMicrotasks();

        const select = screen.getByRole('listbox');

        expect(select).not.toHaveAttribute('data-filled');
      });

      it('adds [data-filled] attribute when already filled', async () => {
        await render(
          <Field.Root>
            <Select.Root defaultValue="1">
              <Select.Trigger data-testid="trigger" />
              <Select.Portal>
                <Select.Positioner>
                  <Select.Popup>
                    <Select.Item value="1">Option 1</Select.Item>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </Field.Root>,
        );

        const trigger = screen.getByTestId('trigger');

        expect(trigger).toHaveAttribute('data-filled');
      });

      it('does not add [data-filled] attribute when single value serializes to empty string', async () => {
        await render(
          <Field.Root>
            <Select.Root value="">
              <Select.Trigger data-testid="trigger" />
              <Select.Portal>
                <Select.Positioner>
                  <Select.Popup>
                    <Select.Item value="">Select</Select.Item>
                    <Select.Item value="1">Option 1</Select.Item>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </Field.Root>,
        );

        expect(screen.getByTestId('trigger')).not.toHaveAttribute('data-filled');
      });

      it('does not add [data-filled] attribute when a non-string value serializes to empty string', async () => {
        const emptyValue = { id: 1, label: 'Empty option' };

        await render(
          <Field.Root>
            <Select.Root
              value={emptyValue}
              itemToStringLabel={(item) => item.label}
              itemToStringValue={() => ''}
            >
              <Select.Trigger data-testid="trigger" />
              <Select.Portal>
                <Select.Positioner>
                  <Select.Popup>
                    <Select.Item value={emptyValue}>Empty option</Select.Item>
                    <Select.Item value={{ id: 2, label: 'Option 1' }}>Option 1</Select.Item>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </Field.Root>,
        );

        expect(screen.getByTestId('trigger')).not.toHaveAttribute('data-filled');
      });

      it('does not add [data-filled] attribute when multiple value is empty', async () => {
        ignoreActWarnings();
        const { user } = await renderFakeTimers(
          <Field.Root>
            <Select.Root multiple>
              <Select.Trigger data-testid="trigger" />
              <Select.Portal>
                <Select.Positioner>
                  <Select.Popup>
                    <Select.Item value="">Select</Select.Item>
                    <Select.Item value="1">Option 1</Select.Item>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </Field.Root>,
        );

        const trigger = screen.getByTestId('trigger');

        expect(trigger).not.toHaveAttribute('data-filled');

        await user.click(trigger);
        await flushMicrotasks();
        await clock.tickAsync(200);

        const option = screen.getByRole('option', { name: 'Option 1' });

        await user.click(option);
        await flushMicrotasks();

        expect(trigger).toHaveAttribute('data-filled', '');

        await user.click(option);
        await flushMicrotasks();

        expect(trigger).not.toHaveAttribute('data-filled');
      });

      it('does not add [data-filled] attribute when multiple defaultValue is empty array', async () => {
        ignoreActWarnings();

        const { user } = await renderFakeTimers(
          <Field.Root>
            <Select.Root multiple defaultValue={[]}>
              <Select.Trigger data-testid="trigger" />
              <Select.Portal>
                <Select.Positioner>
                  <Select.Popup>
                    <Select.Item value="">Select</Select.Item>
                    <Select.Item value="1">Option 1</Select.Item>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </Field.Root>,
        );

        const trigger = screen.getByTestId('trigger');

        expect(trigger).not.toHaveAttribute('data-filled');

        await user.click(trigger);
        await flushMicrotasks();
        await clock.tickAsync(200);

        const option = screen.getByRole('option', { name: 'Option 1' });

        await user.click(option);
        await flushMicrotasks();

        expect(trigger).toHaveAttribute('data-filled', '');

        await user.click(option);
        await flushMicrotasks();

        expect(trigger).not.toHaveAttribute('data-filled');
      });
    });

    it('[data-focused]', async () => {
      await render(
        <Field.Root>
          <Select.Root>
            <Select.Trigger data-testid="trigger" />
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Item value="">Select</Select.Item>
                  <Select.Item value="1">Option 1</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        </Field.Root>,
      );

      const trigger = screen.getByTestId('trigger');

      expect(trigger).not.toHaveAttribute('data-focused');

      fireEvent.focus(trigger);

      expect(trigger).toHaveAttribute('data-focused', '');

      fireEvent.blur(trigger);

      expect(trigger).not.toHaveAttribute('data-focused');
    });

    it('does not mark as touched when focus moves into the popup', async () => {
      const validateSpy = vi.fn(() => 'error');

      await render(
        <React.Fragment>
          <Field.Root validationMode="onBlur" validate={validateSpy}>
            <Select.Root>
              <Select.Trigger data-testid="trigger" />
              <Select.Portal>
                <Select.Positioner>
                  <Select.Popup>
                    <Select.Item value="1">Option 1</Select.Item>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </Field.Root>
          <button data-testid="outside">Outside</button>
        </React.Fragment>,
      );

      const trigger = screen.getByTestId('trigger');

      fireEvent.focus(trigger);
      fireEvent.click(trigger);

      await flushMicrotasks();

      const listbox = screen.getByRole('listbox');

      fireEvent.blur(trigger, { relatedTarget: listbox });
      fireEvent.focus(listbox);

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
            <Select.Root>
              <Select.Trigger data-testid="trigger" />
              <Select.Portal>
                <Select.Positioner>
                  <Select.Popup>
                    <Select.Item value="1">Option 1</Select.Item>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </Field.Root>
          <button data-testid="outside">Outside</button>
        </React.Fragment>,
      );

      const trigger = screen.getByTestId('trigger');
      const outside = screen.getByTestId('outside');

      fireEvent.focus(trigger);
      fireEvent.click(trigger);

      await flushMicrotasks();

      const listbox = screen.getByRole('listbox');

      fireEvent.blur(trigger, { relatedTarget: listbox });
      fireEvent.focus(listbox);

      fireEvent.blur(listbox, { relatedTarget: outside });
      fireEvent.focus(outside);

      await waitFor(() => {
        expect(validateSpy.mock.calls.length).toBe(1);
      });

      // The above `waitFor` might not ensure re-render has finished
      await waitFor(() => {
        expect(trigger).toHaveAttribute('data-touched', '');
      });
      expect(trigger).not.toHaveAttribute('data-focused');
      expect(trigger).toHaveAttribute('aria-invalid', 'true');
    });

    it('prop: validate', async () => {
      await render(
        <Field.Root validationMode="onBlur" validate={() => 'error'}>
          <Select.Root>
            <Select.Trigger data-testid="trigger" />
            <Select.Portal>
              <Select.Positioner />
            </Select.Portal>
          </Select.Root>
        </Field.Root>,
      );

      const trigger = screen.getByTestId('trigger');

      expect(trigger).not.toHaveAttribute('aria-invalid');

      fireEvent.focus(trigger);
      fireEvent.blur(trigger);

      await flushMicrotasks();

      expect(trigger).toHaveAttribute('aria-invalid', 'true');
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
          <Select.Root
            defaultValue={items[0]}
            itemToStringLabel={(item) => item.label}
            itemToStringValue={(item) => item.code}
          >
            <Select.Trigger data-testid="trigger">
              <Select.Value />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner />
            </Select.Portal>
          </Select.Root>
        </Field.Root>,
      );

      const trigger = screen.getByTestId('trigger');

      fireEvent.focus(trigger);
      fireEvent.blur(trigger);

      await waitFor(() => {
        expect(validateSpy.mock.calls.length).toBe(1);
      });
      expect(trigger).toHaveAttribute('aria-invalid', 'true');
    });

    it('prop: validateMode=onSubmit', async () => {
      ignoreActWarnings();

      const { user } = await render(
        <Form>
          <Field.Root validate={(val) => (val === '2' ? 'error' : null)}>
            <Select.Root required>
              <Select.Trigger />
              <Select.Portal>
                <Select.Positioner>
                  <Select.Popup>
                    <Select.Item value="1">Option 1</Select.Item>
                    <Select.Item value="2">Option 2</Select.Item>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </Field.Root>
          <button type="submit">submit</button>
        </Form>,
      );

      const trigger = screen.getByRole('combobox');
      expect(trigger).not.toHaveAttribute('aria-invalid');

      await user.click(screen.getByText('submit'));
      expect(trigger).toHaveAttribute('aria-invalid', 'true');

      // Arrow Down to focus Option 1 (valid)
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');
      expect(trigger).not.toHaveAttribute('aria-invalid');

      await user.click(trigger);
      // Arrow Down to focus Option 2 (invalid)
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');
      expect(trigger).toHaveAttribute('aria-invalid', 'true');

      await user.click(trigger);
      // Arrow Down to focus Option 1 (valid)
      await user.keyboard('{ArrowUp}');
      await user.keyboard('{Enter}');
      await flushMicrotasks();
      expect(trigger).not.toHaveAttribute('aria-invalid');
    });

    // flaky in real browser
    it.skipIf(!isJSDOM)('prop: validationMode=onChange', async () => {
      ignoreActWarnings();
      const { user } = await render(
        <Field.Root
          validationMode="onChange"
          validate={(value) => {
            return value === '1' ? 'error' : null;
          }}
        >
          <Select.Root>
            <Select.Trigger data-testid="trigger">
              <Select.Value />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Item value="1">Option 1</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        </Field.Root>,
      );

      const trigger = screen.getByTestId('trigger');

      expect(trigger).not.toHaveAttribute('aria-invalid');

      await user.click(trigger);

      await flushMicrotasks();

      // Arrow Down to focus the Option 1
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');

      expect(trigger).toHaveAttribute('aria-invalid', 'true');
    });

    it('revalidates when the controlled value changes externally', async () => {
      const validateSpy = vi.fn((value: unknown) => ((value as string) === 'b' ? 'error' : null));

      function App() {
        const [value, setValue] = React.useState('a');

        return (
          <React.Fragment>
            <Field.Root validationMode="onChange" validate={validateSpy} name="flavor">
              <Select.Root value={value} onValueChange={(next) => setValue(next as string)}>
                <Select.Trigger data-testid="trigger">
                  <Select.Value />
                </Select.Trigger>
                <Select.Portal>
                  <Select.Positioner>
                    <Select.Popup>
                      <Select.Item value="a">Option A</Select.Item>
                      <Select.Item value="b">Option B</Select.Item>
                    </Select.Popup>
                  </Select.Positioner>
                </Select.Portal>
              </Select.Root>
            </Field.Root>
            <button type="button" onClick={() => setValue('b')}>
              Select externally
            </button>
          </React.Fragment>
        );
      }

      await render(<App />);

      const trigger = screen.getByTestId('trigger');
      const toggle = screen.getByText('Select externally');

      expect(trigger).not.toHaveAttribute('aria-invalid');
      const initialCallCount = validateSpy.mock.calls.length;

      fireEvent.click(toggle);
      await flushMicrotasks();

      expect(validateSpy.mock.calls.length).toBe(initialCallCount + 1);
      expect(validateSpy.mock.lastCall?.[0]).toBe('b');
      expect(trigger).toHaveAttribute('aria-invalid', 'true');
    });

    // flaky in real browser
    it.skipIf(!isJSDOM)('prop: validationMode=onBlur', async () => {
      ignoreActWarnings();
      const { user } = await render(
        <Field.Root
          validationMode="onBlur"
          validate={(value) => {
            return value === '1' ? 'error' : null;
          }}
        >
          <Select.Root>
            <Select.Trigger data-testid="trigger">
              <Select.Value />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Item value="1">Option 1</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
          <Field.Error data-testid="error" />
        </Field.Root>,
      );

      const trigger = screen.getByTestId('trigger');

      expect(trigger).not.toHaveAttribute('aria-invalid');

      await user.click(trigger);

      await flushMicrotasks();

      // Arrow Down to focus the Option 1
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');

      fireEvent.blur(trigger);

      await flushMicrotasks();

      await waitFor(() => {
        expect(trigger).toHaveAttribute('aria-invalid', 'true');
      });
    });

    it('Field.Label', async () => {
      await render(
        <Field.Root>
          <Select.Root>
            <Select.Trigger data-testid="trigger" />
            <Select.Portal>
              <Select.Positioner />
            </Select.Portal>
          </Select.Root>
          <Field.Label data-testid="label" nativeLabel={false} render={<span />} />
        </Field.Root>,
      );

      expect(screen.getByTestId('trigger')).toHaveAttribute(
        'aria-labelledby',
        screen.getByTestId('label').id,
      );
    });

    it('Select.Label', async () => {
      await render(
        <Select.Root>
          <Select.Label data-testid="label" />
          <Select.Trigger data-testid="trigger" />
          <Select.Portal>
            <Select.Positioner />
          </Select.Portal>
        </Select.Root>,
      );

      expect(screen.getByTestId('trigger')).toHaveAttribute(
        'aria-labelledby',
        screen.getByTestId('label').id,
      );
    });

    it('does not set fallback aria-labelledby when no label is rendered', async () => {
      await render(
        <Select.Root>
          <Select.Trigger data-testid="trigger" aria-label="Font" />
          <Select.Portal>
            <Select.Positioner />
          </Select.Portal>
        </Select.Root>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('trigger')).not.toHaveAttribute('aria-labelledby');
      });
    });

    it('updates Select.Label linkage when root id changes', async () => {
      const { setProps } = await render(
        <Select.Root id="first">
          <Select.Label data-testid="label">Theme</Select.Label>
          <Select.Trigger data-testid="trigger" />
          <Select.Portal>
            <Select.Positioner />
          </Select.Portal>
        </Select.Root>,
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

    it('Select.Label focuses trigger without opening', async () => {
      const { user } = await render(
        <Select.Root>
          <Select.Label data-testid="label">Font</Select.Label>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="sans">Sans-serif</Select.Item>
                <Select.Item value="serif">Serif</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      await user.click(screen.getByTestId('label'));

      expect(screen.getByTestId('trigger')).toHaveFocus();
      expect(screen.queryByRole('listbox')).toBe(null);
    });

    it('Field.Label links to trigger and focuses it', async () => {
      const { user } = await render(
        <Field.Root>
          <Field.Label data-testid="label">Font</Field.Label>
          <Select.Root>
            <Select.Trigger data-testid="trigger">
              <Select.Value />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Item value="sans">Sans-serif</Select.Item>
                  <Select.Item value="serif">Serif</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        </Field.Root>,
      );

      const label = screen.getByTestId<HTMLLabelElement>('label');
      const trigger = screen.getByTestId('trigger');

      expect(label).toHaveAttribute('for', trigger.id);
      expect(trigger).toHaveAttribute('id', label?.htmlFor);

      await user.click(label);

      expect(screen.getByRole('listbox')).toHaveFocus();
    });

    it('Field.Label links to trigger when trigger has an explicit id', async () => {
      const { user } = await render(
        <Field.Root>
          <Field.Label data-testid="label">Font</Field.Label>
          <Select.Root>
            <Select.Trigger data-testid="trigger" id="x-id">
              <Select.Value />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Item value="sans">Sans-serif</Select.Item>
                  <Select.Item value="serif">Serif</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        </Field.Root>,
      );

      const label = screen.getByTestId<HTMLLabelElement>('label');
      const trigger = screen.getByTestId('trigger');

      expect(trigger).toHaveAttribute('id', 'x-id');
      expect(label).toHaveAttribute('for', 'x-id');
      expect(trigger).toHaveAttribute('id', label?.htmlFor);

      await user.click(label);

      expect(screen.getByRole('listbox')).toHaveFocus();
    });

    it('Field.Description', async () => {
      await render(
        <Field.Root>
          <Select.Root>
            <Select.Trigger data-testid="trigger" aria-describedby="external-description" />
            <Select.Portal>
              <Select.Positioner />
            </Select.Portal>
          </Select.Root>
          <Field.Description data-testid="description" />
        </Field.Root>,
      );

      expect(screen.getByTestId('trigger')).toHaveAttribute(
        'aria-describedby',
        `external-description ${screen.getByTestId('description').id}`,
      );
    });
  });

  describe('dynamic items', () => {
    const { render: renderFakeTimers, clock } = createRenderer({
      clockOptions: {
        shouldAdvanceTime: true,
      },
    });

    clock.withFakeTimers();

    it('skips null items when navigating', async () => {
      function DynamicMenu() {
        const [itemsFiltered, setItemsFiltered] = React.useState(false);

        return (
          <Select.Root
            onOpenChange={(newOpen) => {
              if (newOpen) {
                setTimeout(() => {
                  setItemsFiltered(true);
                }, 0);
              }
            }}
            onOpenChangeComplete={(newOpen) => {
              if (!newOpen) {
                setItemsFiltered(false);
              }
            }}
          >
            <Select.Trigger>Toggle</Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Item>Add to Library</Select.Item>
                  {!itemsFiltered && (
                    <React.Fragment>
                      <Select.Item>Add to Playlist</Select.Item>
                      <Select.Item>Play Next</Select.Item>
                      <Select.Item>Play Last</Select.Item>
                    </React.Fragment>
                  )}
                  <Select.Item>Favorite</Select.Item>
                  <Select.Item>Share</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        );
      }

      const { user } = await renderFakeTimers(<DynamicMenu />);

      const trigger = screen.getByText('Toggle');

      await act(async () => {
        trigger.focus();
      });

      await user.keyboard('{ArrowDown}');

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBe(null);
      });

      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowDown}'); // Share
      await user.keyboard('{ArrowDown}'); // Share still

      expect(screen.queryByRole('option', { name: 'Share' })).toHaveFocus();
    });

    it('unselects the selected item if removed', async () => {
      function DynamicMenu() {
        const [items, setItems] = React.useState(['a', 'b', 'c']);
        const [selectedItem, setSelectedItem] = React.useState<string | null>('a');

        return (
          <div>
            <button
              onClick={() => {
                setItems((prev) => prev.filter((item) => item !== 'a'));
              }}
            >
              Remove
            </button>

            <button
              onClick={() => {
                setItems(['a', 'b', 'c']);
              }}
            >
              Add
            </button>
            <div data-testid="value">{selectedItem}</div>

            <Select.Root value={selectedItem} onValueChange={setSelectedItem}>
              <Select.Trigger>Toggle</Select.Trigger>
              <Select.Portal>
                <Select.Positioner>
                  <Select.Popup>
                    {items.map((item) => (
                      <Select.Item key={item} value={item}>
                        {item}
                      </Select.Item>
                    ))}
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </div>
        );
      }

      const { user } = await renderFakeTimers(<DynamicMenu />);

      const trigger = screen.getByText('Toggle');

      await act(async () => {
        trigger.focus();
      });
      await user.keyboard('{ArrowDown}');

      expect(screen.queryByRole('option', { name: 'a' })).toHaveAttribute('data-selected');
      expect(screen.getByTestId('value')).toHaveTextContent('a');

      fireEvent.click(screen.getByText('Remove'));

      expect(screen.queryByRole('option', { name: 'b' })).not.toHaveAttribute('data-selected');

      fireEvent.click(screen.getByText('Add'));

      expect(screen.queryByRole('option', { name: 'a' })).not.toHaveAttribute('data-selected');
    });

    it('resets to default when the selected item is removed from the list', async () => {
      if (reactMajor <= 18) {
        ignoreActWarnings();
      }

      function Test() {
        const [items, setItems] = React.useState(['a', 'b', 'c']);
        return (
          <div>
            <Select.Root defaultValue="b">
              <Select.Trigger data-testid="trigger">
                <Select.Value />
              </Select.Trigger>
              <Select.Portal>
                <Select.Positioner>
                  <Select.Popup>
                    {items.map((it) => (
                      <Select.Item key={it} value={it}>
                        {it}
                      </Select.Item>
                    ))}
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
            <button
              data-testid="remove-c"
              onClick={() => setItems((prev) => prev.filter((i) => i !== 'c'))}
            >
              Remove C
            </button>
          </div>
        );
      }

      const { user } = await render(<Test />);

      const trigger = screen.getByTestId('trigger');

      await user.click(trigger);
      await user.click(screen.getByRole('option', { name: 'c' }));

      await user.click(screen.getByTestId('remove-c'));

      await waitFor(() => {
        expect(trigger).toHaveTextContent('b');
      });

      await user.click(trigger);
      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'b' })).toHaveAttribute('data-selected', '');
      });
    });

    it('resets via onValueChange and does not break in controlled mode when the selected item is removed', async () => {
      if (reactMajor <= 18) {
        ignoreActWarnings();
      }

      function TestControlled() {
        const [items, setItems] = React.useState(['a', 'b', 'c']);
        const [value, setValue] = React.useState<string | null>('c');
        return (
          <div>
            <Select.Root value={value} onValueChange={setValue}>
              <Select.Trigger data-testid="trigger">
                <Select.Value />
              </Select.Trigger>
              <Select.Portal>
                <Select.Positioner>
                  <Select.Popup>
                    {items.map((it) => (
                      <Select.Item key={it} value={it}>
                        {it}
                      </Select.Item>
                    ))}
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
            <button
              data-testid="remove-c"
              onClick={() => setItems((prev) => prev.filter((i) => i !== 'c'))}
            >
              Remove C
            </button>
          </div>
        );
      }

      const { user } = await render(<TestControlled />);

      const trigger = screen.getByTestId('trigger');
      expect(trigger).toHaveTextContent('c');

      await user.click(screen.getByTestId('remove-c'));

      // Opening should not break; and no option is selected since the value is missing from list
      await user.click(trigger);

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeVisible();
      });

      const options = await screen.findAllByRole('option');
      options.forEach((opt) => {
        expect(opt).not.toHaveAttribute('data-selected');
      });
    });

    it.skipIf(isJSDOM)(
      'resets aligned positioning after controlled value reset and option replacement',
      async () => {
        function Test() {
          const [group, setGroup] = React.useState<'a' | 'b'>('a');
          const [value, setValue] = React.useState<string | null>(null);
          const options = Array.from({ length: 40 }, (_, index) => `${group}-${index}`);

          return (
            <div style={{ paddingTop: 120, paddingLeft: 32 }}>
              <button
                data-testid="replace-options"
                onClick={() => {
                  setGroup('b');
                  setValue(null);
                }}
              >
                Replace options
              </button>
              <Select.Root value={value} onValueChange={setValue}>
                <Select.Trigger data-testid="trigger" style={{ width: 160, height: 36 }}>
                  <Select.Value placeholder="Pick one" />
                </Select.Trigger>
                <Select.Portal>
                  <Select.Positioner data-testid="positioner">
                    <Select.Popup style={{ maxHeight: 'none', minHeight: 100 }}>
                      {options.map((option, index) => (
                        <Select.Item key={index} value={option}>
                          <Select.ItemText>{option}</Select.ItemText>
                        </Select.Item>
                      ))}
                    </Select.Popup>
                  </Select.Positioner>
                </Select.Portal>
              </Select.Root>
            </div>
          );
        }

        const { user } = await render(<Test />);

        const trigger = screen.getByTestId('trigger');

        await user.click(trigger);
        await user.click(await screen.findByRole('option', { name: 'a-35' }));
        await user.click(screen.getByTestId('replace-options'));
        await user.click(trigger);

        const listbox = await screen.findByRole('listbox');
        const positioner = screen.getByTestId('positioner');
        const firstOption = screen.getByRole('option', { name: 'b-0' });

        await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'true'));
        await waitFor(() => expect(listbox.scrollTop).toBe(0));
        await waitFor(() =>
          expect(firstOption.getBoundingClientRect().top).toBeGreaterThanOrEqual(
            positioner.getBoundingClientRect().top,
          ),
        );
      },
    );

    it.skipIf(isJSDOM)(
      'resets aligned positioning when value reset, option replacement, and controlled open happen together',
      async () => {
        function Test() {
          const [group, setGroup] = React.useState<'a' | 'b'>('a');
          const [value, setValue] = React.useState<string | null>(null);
          const [open, setOpen] = React.useState(false);
          const options = Array.from({ length: 40 }, (_, index) => `${group}-${index}`);

          return (
            <div style={{ paddingTop: 120, paddingLeft: 32 }}>
              <button
                data-testid="replace-options-and-open"
                onClick={() => {
                  setGroup('b');
                  setValue(null);
                  setOpen(true);
                }}
              >
                Replace options and open
              </button>
              <Select.Root
                value={value}
                onValueChange={setValue}
                open={open}
                onOpenChange={setOpen}
              >
                <Select.Trigger data-testid="trigger" style={{ width: 160, height: 36 }}>
                  <Select.Value placeholder="Pick one" />
                </Select.Trigger>
                <Select.Portal>
                  <Select.Positioner data-testid="positioner">
                    <Select.Popup style={{ maxHeight: 'none', minHeight: 100 }}>
                      {options.map((option, index) => (
                        <Select.Item key={index} value={option}>
                          <Select.ItemText>{option}</Select.ItemText>
                        </Select.Item>
                      ))}
                    </Select.Popup>
                  </Select.Positioner>
                </Select.Portal>
              </Select.Root>
            </div>
          );
        }

        const { user } = await render(<Test />);

        const trigger = screen.getByTestId('trigger');

        await user.click(trigger);
        await user.click(await screen.findByRole('option', { name: 'a-35' }));
        await user.click(screen.getByTestId('replace-options-and-open'));

        const listbox = await screen.findByRole('listbox');
        const positioner = screen.getByTestId('positioner');
        const firstOption = screen.getByRole('option', { name: 'b-0' });

        await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'true'));
        await waitFor(() => expect(listbox.scrollTop).toBe(0));
        await waitFor(() =>
          expect(firstOption.getBoundingClientRect().top).toBeGreaterThanOrEqual(
            positioner.getBoundingClientRect().top,
          ),
        );
      },
    );

    it.skipIf(isJSDOM)(
      'resets aligned positioning when a stale controlled value, option replacement, and controlled open happen together',
      async () => {
        function Test() {
          const [group, setGroup] = React.useState<'a' | 'b'>('a');
          const [value, setValue] = React.useState<string | null>(null);
          const [open, setOpen] = React.useState(false);
          const options = Array.from({ length: 40 }, (_, index) => `${group}-${index}`);

          return (
            <div style={{ paddingTop: 120, paddingLeft: 32 }}>
              <button
                data-testid="replace-options-and-open"
                onClick={() => {
                  setGroup('b');
                  setOpen(true);
                }}
              >
                Replace options and open
              </button>
              <Select.Root
                value={value}
                onValueChange={setValue}
                open={open}
                onOpenChange={setOpen}
              >
                <Select.Trigger data-testid="trigger" style={{ width: 160, height: 36 }}>
                  <Select.Value placeholder="Pick one" />
                </Select.Trigger>
                <Select.Portal>
                  <Select.Positioner data-testid="positioner">
                    <Select.Popup style={{ maxHeight: 'none', minHeight: 100 }}>
                      {options.map((option, index) => (
                        <Select.Item key={index} value={option}>
                          <Select.ItemText>{option}</Select.ItemText>
                        </Select.Item>
                      ))}
                    </Select.Popup>
                  </Select.Positioner>
                </Select.Portal>
              </Select.Root>
            </div>
          );
        }

        const { user } = await render(<Test />);

        const trigger = screen.getByTestId('trigger');

        await user.click(trigger);
        await user.click(await screen.findByRole('option', { name: 'a-35' }));
        await user.click(screen.getByTestId('replace-options-and-open'));

        const listbox = await screen.findByRole('listbox');
        const positioner = screen.getByTestId('positioner');
        const firstOption = screen.getByRole('option', { name: 'b-0' });

        await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'true'));
        await waitFor(() => expect(listbox.scrollTop).toBe(0));
        await waitFor(() =>
          expect(firstOption.getBoundingClientRect().top).toBeGreaterThanOrEqual(
            positioner.getBoundingClientRect().top,
          ),
        );
      },
    );

    it('falls back to null when both selected and initial default are removed (uncontrolled)', async () => {
      if (reactMajor <= 18) {
        ignoreActWarnings();
      }

      function Test() {
        const [items, setItems] = React.useState(['a', 'b', 'c']);
        return (
          <div>
            <Select.Root defaultValue="b">
              <Select.Trigger data-testid="trigger">
                <Select.Value />
              </Select.Trigger>
              <Select.Portal>
                <Select.Positioner>
                  <Select.Popup>
                    {items.map((it) => (
                      <Select.Item key={it} value={it}>
                        {it}
                      </Select.Item>
                    ))}
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
            <button
              data-testid="remove-b"
              onClick={() => setItems((prev) => prev.filter((i) => i !== 'b'))}
            >
              Remove B
            </button>
            <button
              data-testid="remove-c"
              onClick={() => setItems((prev) => prev.filter((i) => i !== 'c'))}
            >
              Remove C
            </button>
          </div>
        );
      }

      const { user } = await render(<Test />);

      const trigger = screen.getByTestId('trigger');

      await user.click(trigger);
      await user.click(screen.getByRole('option', { name: 'c' }));

      await user.click(screen.getByTestId('remove-b'));
      await user.click(screen.getByTestId('remove-c'));

      // Now no fallback remains; value should reset to null
      await waitFor(() => {
        expect(trigger).toHaveTextContent('');
      });

      await user.click(trigger);

      const options = await screen.findAllByRole('option');
      options.forEach((opt) => {
        expect(opt).not.toHaveAttribute('data-selected');
      });
    });

    it('falls back to null when both selected and initial default are removed (controlled)', async () => {
      if (reactMajor <= 18) {
        ignoreActWarnings();
      }

      function TestControlled() {
        const [items, setItems] = React.useState(['a', 'b', 'c']);
        const [value, setValue] = React.useState<string | null>('c');
        return (
          <div>
            <Select.Root value={value} onValueChange={setValue}>
              <Select.Trigger data-testid="trigger">
                <Select.Value />
              </Select.Trigger>
              <Select.Portal>
                <Select.Positioner>
                  <Select.Popup>
                    {items.map((it) => (
                      <Select.Item key={it} value={it}>
                        {it}
                      </Select.Item>
                    ))}
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
            <button
              data-testid="remove-b"
              onClick={() => setItems((prev) => prev.filter((i) => i !== 'b'))}
            >
              Remove B
            </button>
            <button
              data-testid="remove-c"
              onClick={() => setItems((prev) => prev.filter((i) => i !== 'c'))}
            >
              Remove C
            </button>
          </div>
        );
      }

      const { user } = await render(<TestControlled />);
      const trigger = screen.getByTestId('trigger');

      await user.click(screen.getByTestId('remove-b'));
      await user.click(screen.getByTestId('remove-c'));

      await user.click(trigger);

      const options = await screen.findAllByRole('option');
      options.forEach((opt) => {
        expect(opt).not.toHaveAttribute('data-selected');
      });
    });
  });

  describe('typeahead', () => {
    it.skipIf(isJSDOM)(
      'does not trigger selection when Space is pressed during text navigation',
      async () => {
        const handleItemClick = vi.fn();
        const handleValueChange = vi.fn();

        const { user } = await render(
          <Select.Root defaultOpen onValueChange={handleValueChange}>
            <Select.Trigger data-testid="trigger">
              <Select.Value data-testid="value" />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Item value="one" onClick={() => handleItemClick()}>
                    Item One
                  </Select.Item>
                  <Select.Item value="two" onClick={() => handleItemClick()}>
                    Item Two
                  </Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>,
        );

        const options = screen.getAllByRole('option');

        await act(async () => {
          options[0].focus();
        });

        await user.keyboard('Item T');

        expect(handleItemClick.mock.calls.length > 0).toBe(false);
        expect(handleValueChange.mock.calls.length > 0).toBe(false);

        await waitFor(() => {
          expect(options[1]).toHaveFocus();
        });
      },
    );

    it('skips disabled items and commits the next match via typeahead on a closed trigger', async () => {
      function App() {
        const [value, setValue] = React.useState<string | null>(null);
        return (
          <Select.Root value={value} onValueChange={setValue}>
            <Select.Trigger data-testid="trigger">
              <Select.Value data-testid="value" />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Item value="apricot" disabled>
                    apricot
                  </Select.Item>
                  <Select.Item value="avocado">avocado</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        );
      }

      const { user } = await render(<App />);
      const trigger = screen.getByTestId('trigger');
      const valueEl = screen.getByTestId('value');

      // "apricot" and "avocado" both start with "a", but "apricot" is disabled. A single "a"
      // keypress must skip the disabled "apricot" and land on "avocado" — like native `<select>`
      // and arrow-key navigation — not stop on (or bail at) the disabled match.
      await act(async () => trigger.focus());
      await user.keyboard('a');
      expect(valueEl.textContent).toBe('avocado');
    });

    it('commits nothing when the only typeahead match is disabled (closed trigger)', async () => {
      function App() {
        const [value, setValue] = React.useState<string | null>(null);
        return (
          <Select.Root value={value} onValueChange={setValue}>
            <Select.Trigger data-testid="trigger">
              <Select.Value data-testid="value" />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Item value="cherry">cherry</Select.Item>
                  <Select.Item value="banana" disabled>
                    banana
                  </Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        );
      }

      const { user } = await render(<App />);
      const trigger = screen.getByTestId('trigger');
      const valueEl = screen.getByTestId('value');

      // "banana" is the only "b" item and it's disabled, so there is no selectable match.
      await act(async () => trigger.focus());
      await user.keyboard('b');
      expect(valueEl.textContent).toBe('');
    });

    it('does not let a disabled double-letter item block rapid cycling among enabled matches', async () => {
      function App() {
        const [value, setValue] = React.useState<string | null>(null);
        return (
          <Select.Root value={value} onValueChange={setValue}>
            <Select.Trigger data-testid="trigger">
              <Select.Value data-testid="value" />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Item value="aaron" disabled>
                    aaron
                  </Select.Item>
                  <Select.Item value="apple">apple</Select.Item>
                  <Select.Item value="avocado">avocado</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        );
      }

      const { user } = await render(<App />);
      const trigger = screen.getByTestId('trigger');
      const valueEl = screen.getByTestId('value');

      // The disabled "aaron" has a doubled first letter, which would otherwise disable
      // rapid same-letter cycling. Because disabled items are skipped while matching, they
      // must not count toward that guard: pressing "a" twice should cycle apple -> avocado.
      await act(async () => trigger.focus());
      await user.keyboard('a');
      expect(valueEl.textContent).toBe('apple');
      await user.keyboard('a');
      expect(valueEl.textContent).toBe('avocado');
    });

    it.skipIf(isJSDOM)(
      'skips disabled items when highlighting via typeahead on an open popup',
      async () => {
        const { user } = await render(
          <Select.Root defaultOpen>
            <Select.Trigger data-testid="trigger">
              <Select.Value data-testid="value" />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Item value="apricot" disabled>
                    apricot
                  </Select.Item>
                  <Select.Item value="avocado">avocado</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>,
        );

        const apricot = await screen.findByRole('option', { name: 'apricot' });
        const avocado = screen.getByRole('option', { name: 'avocado' });

        await act(async () => {
          avocado.focus();
        });

        // Open-state typeahead highlights via `activeIndex` (the closed branch commits the value
        // instead). Typing "a" must skip the disabled "apricot" and highlight "avocado".
        await user.keyboard('a');

        await waitFor(() => {
          expect(avocado).toHaveAttribute('data-highlighted');
        });
        expect(apricot).not.toHaveAttribute('data-highlighted');
      },
    );

    it('starts from the first match after value reset (closed)', async () => {
      function App() {
        const [value, setValue] = React.useState<string | null>(null);
        return (
          <React.Fragment>
            <button data-testid="reset" onClick={() => setValue(null)}>
              Reset
            </button>
            <Select.Root value={value} onValueChange={setValue}>
              <Select.Trigger data-testid="trigger">
                <Select.Value data-testid="value" />
              </Select.Trigger>
              <Select.Portal>
                <Select.Positioner>
                  <Select.Popup>
                    <Select.Item value="a1">A1</Select.Item>
                    <Select.Item value="a2">A2</Select.Item>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </React.Fragment>
        );
      }

      const { user } = await render(<App />);

      const trigger = screen.getByTestId('trigger');
      const valueEl = screen.getByTestId('value');
      const resetBtn = screen.getByTestId('reset');

      await act(async () => trigger.focus());
      await user.keyboard('a');
      expect(valueEl.textContent).toBe('a1');

      await user.click(resetBtn);

      await act(async () => trigger.focus());
      await user.keyboard('a');
      expect(valueEl.textContent).toBe('a1');
    });

    it('does not jump matches after a closed-state value reset', async () => {
      function App() {
        const [value, setValue] = React.useState<string | null>('dog');
        return (
          <React.Fragment>
            <button data-testid="set-car" onClick={() => setValue('car')}>
              Set car
            </button>
            <Select.Root value={value} onValueChange={setValue}>
              <Select.Trigger data-testid="trigger">
                <Select.Value data-testid="value" />
              </Select.Trigger>
              <Select.Portal>
                <Select.Positioner>
                  <Select.Popup>
                    <Select.Item value="car">car</Select.Item>
                    <Select.Item value="cat">cat</Select.Item>
                    <Select.Item value="dog">dog</Select.Item>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </React.Fragment>
        );
      }

      const { user } = await render(<App />);

      const trigger = screen.getByTestId('trigger');
      const valueEl = screen.getByTestId('value');
      const setCarButton = screen.getByTestId('set-car');

      expect(valueEl.textContent).toBe('dog');

      await user.click(setCarButton);
      expect(valueEl.textContent).toBe('car');

      await act(async () => trigger.focus());
      await user.keyboard('c');
      expect(valueEl.textContent).toBe('cat');

      await user.keyboard('a');
      expect(valueEl.textContent).toBe('cat');
    });
  });

  describe('prop: multiple', () => {
    it('removes selections that no longer exist', async () => {
      function Test() {
        const [items, setItems] = React.useState(['a', 'b', 'c']);
        return (
          <div>
            <Select.Root multiple defaultValue={['a', 'c']}>
              <Select.Trigger data-testid="trigger">
                <Select.Value />
              </Select.Trigger>
              <Select.Portal>
                <Select.Positioner>
                  <Select.Popup>
                    {items.map((it) => (
                      <Select.Item key={it} value={it}>
                        {it}
                      </Select.Item>
                    ))}
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
            <button
              data-testid="remove-a"
              onClick={() => setItems((prev) => prev.filter((i) => i !== 'a'))}
            >
              Remove A
            </button>
            <button
              data-testid="remove-c"
              onClick={() => setItems((prev) => prev.filter((i) => i !== 'c'))}
            >
              Remove C
            </button>
          </div>
        );
      }

      const { user } = await render(<Test />);

      const trigger = screen.getByTestId('trigger');
      await user.click(trigger);

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'a' })).toHaveAttribute('data-selected', '');
      });
      expect(screen.getByRole('option', { name: 'c' })).toHaveAttribute('data-selected', '');

      // Remove one of the selected items; remaining selection should persist
      await user.click(screen.getByTestId('remove-c'));

      await user.click(trigger);

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'a' })).toHaveAttribute('data-selected', '');
      });
      expect(screen.queryByRole('option', { name: 'c' })).toBe(null);

      // Remove the last selected item; selection should become empty
      await user.click(screen.getByTestId('remove-a'));

      await user.click(trigger);

      const options = await screen.findAllByRole('option');
      options.forEach((opt) => {
        expect(opt).not.toHaveAttribute('data-selected');
      });
    });

    it('should allow multiple selections when multiple is true', async () => {
      const handleValueChange = vi.fn();

      function App() {
        const [value, setValue] = React.useState<any[]>([]);

        return (
          <Select.Root
            multiple
            value={value}
            onValueChange={(newValue) => {
              setValue(newValue);
              handleValueChange(newValue);
            }}
          >
            <Select.Trigger data-testid="trigger">
              <Select.Value />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Item value="a">a</Select.Item>
                  <Select.Item value="b">b</Select.Item>
                  <Select.Item value="c">c</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        );
      }

      const { user } = await render(<App />);

      const trigger = screen.getByTestId('trigger');

      await user.click(trigger);
      await flushMicrotasks();

      const optionA = await screen.findByRole('option', { name: 'a' });
      await user.click(optionA);
      await flushMicrotasks();

      expect(handleValueChange.mock.calls[0][0]).toEqual(['a']);
      expect(optionA).toHaveAttribute('data-selected', '');

      const optionB = screen.getByRole('option', { name: 'b' });
      await user.click(optionB);
      await flushMicrotasks();

      expect(handleValueChange.mock.calls[1][0]).toEqual(['a', 'b']);
      expect(optionA).toHaveAttribute('data-selected', '');
      expect(optionB).toHaveAttribute('data-selected', '');

      expect(screen.getByRole('listbox')).not.toBe(null);
    });

    it('should deselect items when clicked again in multiple mode', async () => {
      const handleValueChange = vi.fn();

      function App() {
        const [value, setValue] = React.useState(['a', 'b']);

        return (
          <Select.Root
            multiple
            value={value}
            onValueChange={(newValue) => {
              setValue(newValue);
              handleValueChange(newValue);
            }}
          >
            <Select.Trigger data-testid="trigger">
              <Select.Value />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Item value="a">a</Select.Item>
                  <Select.Item value="b">b</Select.Item>
                  <Select.Item value="c">c</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        );
      }

      const { user } = await render(<App />);

      const trigger = screen.getByTestId('trigger');

      await user.click(trigger);
      await flushMicrotasks();

      const optionA = await screen.findByRole('option', { name: 'a' });
      const optionB = screen.getByRole('option', { name: 'b' });

      expect(optionA).toHaveAttribute('data-selected', '');
      expect(optionB).toHaveAttribute('data-selected', '');

      await user.click(optionA);
      await flushMicrotasks();

      expect(handleValueChange.mock.calls[0][0]).toEqual(['b']);
      expect(optionA).not.toHaveAttribute('data-selected');
      expect(optionB).toHaveAttribute('data-selected', '');
    });

    it('should update selected items when the controlled value prop changes while open', async () => {
      const { setProps } = await render(
        <Select.Root multiple value={['a', 'b']}>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
                <Select.Item value="c">c</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      const trigger = screen.getByTestId('trigger');

      fireEvent.click(trigger);
      await flushMicrotasks();

      expect(screen.getByRole('option', { name: 'a' })).toHaveAttribute('data-selected', '');
      expect(screen.getByRole('option', { name: 'b' })).toHaveAttribute('data-selected', '');

      await setProps({ value: ['b'] });

      expect(screen.getByRole('option', { name: 'b' })).toHaveAttribute('data-selected', '');
      expect(screen.getByRole('option', { name: 'a' })).not.toHaveAttribute('data-selected');
    });

    it('keeps the active index on a deselected item in multiple mode', async () => {
      const { user } = await render(
        <Select.Root multiple value={['a']}>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
                <Select.Item value="c">c</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      const trigger = screen.getByTestId('trigger');

      await user.click(trigger);

      const optionB = await screen.findByRole('option', { name: 'b' });

      await user.click(optionB);

      await waitFor(() => {
        expect(optionB).toHaveAttribute('data-highlighted');
      });

      await user.click(optionB);

      await waitFor(() => {
        expect(optionB).toHaveAttribute('data-highlighted');
      });
    });

    it('should handle defaultValue as array in multiple mode', async () => {
      await render(
        <Select.Root multiple defaultValue={['a', 'c']}>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
                <Select.Item value="c">c</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      const trigger = screen.getByTestId('trigger');

      fireEvent.click(trigger);
      await flushMicrotasks();

      expect(screen.getByRole('option', { name: 'a' })).toHaveAttribute('data-selected', '');
      expect(screen.getByRole('option', { name: 'b' })).not.toHaveAttribute('data-selected');
      expect(screen.getByRole('option', { name: 'c' })).toHaveAttribute('data-selected', '');
    });

    it('should serialize multiple values correctly for form submission', async () => {
      const { container } = await render(
        <Select.Root multiple name="select" value={['a', 'c']}>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
                <Select.Item value="c">c</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      // eslint-disable-next-line testing-library/no-container -- No appropriate method on screen since it's a hidden input without any type
      const hiddenInputs = container.querySelectorAll(
        '[name="select"]',
      ) as NodeListOf<HTMLInputElement>;
      expect(hiddenInputs).toHaveLength(2);
      const values = Array.from(hiddenInputs).map((input) => input.value);
      expect(values).toEqual(['a', 'c']);
    });

    it.skipIf(isJSDOM)('does not submit multiple values when disabled', async () => {
      const submitSpy = vi.fn((event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        return formData.getAll('select');
      });

      const { user } = await render(
        <form onSubmit={submitSpy}>
          <Select.Root multiple disabled name="select" value={['a', 'c']}>
            <Select.Trigger>
              <Select.Value />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Item value="a">a</Select.Item>
                  <Select.Item value="b">b</Select.Item>
                  <Select.Item value="c">c</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
          <button type="submit">Submit</button>
        </form>,
      );

      await user.click(screen.getByRole('button', { name: 'Submit' }));

      expect(submitSpy.mock.calls.length).toBe(1);
      expect(submitSpy.mock.results.at(-1)?.value).toEqual([]);
    });

    it('should serialize empty array as empty string in multiple mode', async () => {
      const { container } = await render(
        <Select.Root multiple name="select">
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
                <Select.Item value="c">c</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      // In multiple mode with empty array, no hidden inputs with name should exist
      // eslint-disable-next-line testing-library/no-container -- No appropriate method on screen since it's a hidden input without any type
      const namedHiddenInputs = container.querySelectorAll('[name="select"]');
      expect(namedHiddenInputs).toHaveLength(0);

      // But the main input should have the serialized empty value for Field validation purposes
      // eslint-disable-next-line testing-library/no-container -- No appropriate method on screen since it's a hidden input without any type
      const mainInput = container.querySelector<HTMLInputElement>('input[aria-hidden="true"]');
      expect(mainInput).not.toBe(null);
      expect(mainInput?.value).toBe('');
    });

    it('does not mark the hidden input as required when selection exists', async () => {
      await render(
        <Select.Root multiple required name="select" value={['a']}>
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
        </Select.Root>,
      );

      const hiddenInput = screen.getByRole('textbox', { hidden: true });
      expect(hiddenInput).not.toBe(null);
      expect(hiddenInput).not.toHaveAttribute('required');
    });

    it('keeps the hidden input required when no selection exists', async () => {
      await render(
        <Select.Root multiple required name="select" value={[]}>
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
        </Select.Root>,
      );

      const hiddenInput = screen.getByRole('textbox', { hidden: true });
      expect(hiddenInput).not.toBe(null);
      expect(hiddenInput).toHaveAttribute('required');
    });

    it('should not close popup when selecting items in multiple mode', async () => {
      const { user } = await render(
        <Select.Root multiple>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
                <Select.Item value="c">c</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      const trigger = screen.getByTestId('trigger');

      await user.click(trigger);
      await flushMicrotasks();

      await waitFor(() => {
        expect(screen.getByRole('listbox')).not.toBe(null);
      });

      const optionA = await screen.findByRole('option', { name: 'a' });
      await user.click(optionA);
      await flushMicrotasks();

      expect(screen.getByRole('listbox')).not.toBe(null);

      const optionB = screen.getByRole('option', { name: 'b' });
      await user.click(optionB);
      await flushMicrotasks();

      expect(screen.getByRole('listbox')).not.toBe(null);
    });

    it('should close popup in single select mode', async () => {
      const { user } = await render(
        <Select.Root>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
                <Select.Item value="c">c</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      const trigger = screen.getByTestId('trigger');

      await user.click(trigger);
      await flushMicrotasks();

      await waitFor(() => {
        expect(screen.getByRole('listbox')).not.toBe(null);
      });

      const optionA = await screen.findByRole('option', { name: 'a' });
      await user.click(optionA);
      await flushMicrotasks();

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBe(null);
      });
    });

    it('should update selected items when value prop changes', async () => {
      const { setProps } = await render(
        <Select.Root multiple value={['a']}>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
                <Select.Item value="c">c</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      const trigger = screen.getByTestId('trigger');

      fireEvent.click(trigger);
      await flushMicrotasks();

      expect(await screen.findByRole('option', { name: 'a' })).toHaveAttribute('data-selected', '');
      expect(screen.getByRole('option', { name: 'b' })).not.toHaveAttribute('data-selected');

      await setProps({ value: ['a', 'b', 'c'] });

      expect(screen.getByRole('option', { name: 'a' })).toHaveAttribute('data-selected', '');
      expect(screen.getByRole('option', { name: 'b' })).toHaveAttribute('data-selected', '');
      expect(screen.getByRole('option', { name: 'c' })).toHaveAttribute('data-selected', '');
    });
  });

  describe('prop: isItemEqualToValue', () => {
    it('matches object values using the provided comparator', async () => {
      const users = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ];

      await render(
        <Select.Root
          value={{ id: 2, name: 'Bob' }}
          itemToStringLabel={(item) => item.name}
          itemToStringValue={(item) => String(item.id)}
          isItemEqualToValue={(item, value) => item.id === value.id}
        >
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                {users.map((user) => (
                  <Select.Item key={user.id} value={user}>
                    {user.name}
                  </Select.Item>
                ))}
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      expect(trigger).toHaveTextContent('Bob');

      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Bob' })).toHaveAttribute('data-selected', '');
      });
    });

    it('matches object values when the popup is mounted on the initial render', async () => {
      const users = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ];

      await render(
        <Select.Root
          defaultOpen
          value={{ id: 2, name: 'Bob' }}
          itemToStringLabel={(item) => item.name}
          itemToStringValue={(item) => String(item.id)}
          isItemEqualToValue={(item, value) => item.id === value.id}
        >
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                {users.map((user) => (
                  <Select.Item key={user.id} value={user}>
                    {user.name}
                  </Select.Item>
                ))}
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      expect(screen.getByRole('option', { name: 'Bob' })).toHaveAttribute('data-selected', '');
      expect(screen.getByRole('option', { name: 'Alice' })).not.toHaveAttribute('data-selected');
    });

    it('passes item as the first comparator argument in multiple mode', async () => {
      const users = [
        { id: 1, name: 'Alice', source: 'item' },
        { id: 2, name: 'Bob', source: 'item' },
      ];

      await render(
        <Select.Root
          multiple
          defaultOpen
          defaultValue={[{ id: 2, name: 'Bob', source: 'selected' }]}
          itemToStringLabel={(item) => item.name}
          itemToStringValue={(item) => String(item.id)}
          isItemEqualToValue={(item, value) =>
            item.id === value.id && item.source === 'item' && value.source === 'selected'
          }
        >
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                {users.map((user) => (
                  <Select.Item key={user.id} value={user}>
                    {user.name}
                  </Select.Item>
                ))}
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      const option = screen.getByRole('option', { name: 'Bob' });
      expect(option).toHaveAttribute('data-selected', '');

      fireEvent.click(option);

      await waitFor(() => {
        expect(screen.getByRole('option', { name: 'Bob' })).not.toHaveAttribute('data-selected');
      });
    });
  });

  describe('prop: highlightItemOnHover', () => {
    it('highlights an item on mouse move by default', async () => {
      const { user } = await render(
        <Select.Root defaultOpen>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
                <Select.Item value="c">c</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      const optionB = screen.getByRole('option', { name: 'b' });
      await user.hover(optionB);

      await waitFor(() => {
        expect(optionB).toHaveAttribute('data-highlighted');
      });
    });

    it.skipIf(isJSDOM)(
      'highlights the first item after opening when alignItemWithTrigger is active and no value is selected',
      async () => {
        await render(
          <div style={{ paddingTop: 120, paddingLeft: 24 }}>
            <Select.Root>
              <Select.Trigger data-testid="trigger" style={{ width: 120, height: 36 }}>
                <Select.Value placeholder="Pick one" />
              </Select.Trigger>
              <Select.Portal>
                <Select.Positioner>
                  <Select.Popup style={{ maxHeight: 'none' }}>
                    <Select.Item value="a">a</Select.Item>
                    <Select.Item value="b">b</Select.Item>
                    <Select.Item value="c">c</Select.Item>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </div>,
        );

        const trigger = screen.getByTestId('trigger');
        fireEvent.pointerDown(trigger, { pointerType: 'mouse' });
        fireEvent.mouseDown(trigger);

        const optionA = await screen.findByRole('option', { name: 'a' });

        await waitFor(() => {
          expect(optionA).toHaveAttribute('data-highlighted');
        });
      },
    );

    it('does not highlight items from mouse movement when disabled', async () => {
      const { user } = await render(
        <Select.Root defaultOpen highlightItemOnHover={false}>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
                <Select.Item value="c">c</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      const optionB = screen.getByRole('option', { name: 'b' });
      await user.hover(optionB);

      await flushMicrotasks();

      expect(optionB).not.toHaveAttribute('data-highlighted');
    });

    it('does not remove highlight when mousing out of popup when disabled', async () => {
      const { user } = await render(
        <Select.Root defaultOpen highlightItemOnHover={false}>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
                <Select.Item value="c">c</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      const optionA = screen.getByRole('option', { name: 'a' });
      await user.hover(optionA);

      await user.keyboard('{ArrowDown}');

      await waitFor(() => {
        expect(optionA).toHaveAttribute('data-highlighted');
      });

      const popup = screen.getByRole('listbox');
      await user.unhover(popup);

      await waitFor(() => {
        expect(optionA).toHaveAttribute('data-highlighted');
      });
    });
  });
});
