import { expect, vi } from 'vitest';
import { Select } from '@base-ui/react/select';
import { createRenderer, describeConformance, isJSDOM } from '#test-utils';
import { fireEvent, screen, waitFor } from '@mui/internal-test-utils';

describe('<Select.Trigger />', () => {
  const { render } = createRenderer();

  describeConformance(<Select.Trigger />, () => ({
    refInstanceof: window.HTMLButtonElement,
    button: true,
    render(node) {
      return render(<Select.Root open>{node}</Select.Root>);
    },
  }));

  describe('disabled state', () => {
    it('cannot be focused when disabled', async () => {
      const { user } = await render(
        <Select.Root defaultValue="b">
          <Select.Trigger data-testid="trigger" disabled>
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
      expect(trigger).toHaveAttribute('data-disabled');

      await user.keyboard('[Tab]');

      expect(expect(document.activeElement)).not.toBe(trigger);
    });

    it('does not toggle the popup when disabled', async () => {
      const handleOpenChange = vi.fn();
      await render(
        <Select.Root defaultValue="b" onOpenChange={handleOpenChange}>
          <Select.Trigger data-testid="trigger" disabled>
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

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBe(null);
      });
      expect(handleOpenChange.mock.calls.length).toBe(0);
    });
  });

  describe('placeholder state', () => {
    it('should have the data-placeholder attribute when provided `null` value', async () => {
      await render(
        <Select.Root value={null}>
          <Select.Trigger data-testid="trigger">
            <Select.Value data-testid="value" />
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
      const value = screen.getByTestId('value');

      expect(trigger).toHaveAttribute('data-placeholder');
      expect(value).toHaveAttribute('data-placeholder');
    });

    it('should have the data-placeholder attribute when provided custom property with `itemToStringValue`', async () => {
      const shippingMethods = [
        { id: '', name: 'Default' },
        { id: 'standard', name: 'Standard' },
        { id: 'express', name: 'Express' },
        { id: 'overnight', name: 'Overnight' },
      ];

      await render(
        <Select.Root
          defaultValue={shippingMethods[0]}
          itemToStringValue={(item) => item.id}
          itemToStringLabel={(item) => item.name}
        >
          <Select.Trigger data-testid="trigger">
            <Select.Value data-testid="value" />
          </Select.Trigger>
        </Select.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      const value = screen.getByTestId('value');

      expect(trigger).toHaveAttribute('data-placeholder');
      expect(value).toHaveAttribute('data-placeholder');
      expect(value.textContent).toBe('Default');
    });

    it('should have the data-placeholder attribute when provided { value: null }', async () => {
      const fonts = [{ label: 'Select font', value: null }];

      await render(
        <Select.Root items={fonts}>
          <Select.Trigger data-testid="trigger">
            <Select.Value data-testid="value" />
          </Select.Trigger>
        </Select.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      const value = screen.getByTestId('value');

      expect(trigger).toHaveAttribute('data-placeholder');
      expect(value).toHaveAttribute('data-placeholder');
      expect(value.textContent).toBe('Select font');
    });

    it('should not have the data-placeholder attribute when provided a value', async () => {
      await render(
        <Select.Root defaultValue="a">
          <Select.Trigger data-testid="trigger">
            <Select.Value data-testid="value" />
          </Select.Trigger>
        </Select.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      const value = screen.getByTestId('value');

      expect(trigger).not.toHaveAttribute('data-placeholder');
      expect(value).not.toHaveAttribute('data-placeholder');
    });

    it('should not have the data-placeholder attribute when multiple mode has a default value', async () => {
      await render(
        <Select.Root multiple defaultValue={['a']}>
          <Select.Trigger data-testid="trigger">
            <Select.Value data-testid="value" />
          </Select.Trigger>
        </Select.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      const value = screen.getByTestId('value');

      expect(trigger).not.toHaveAttribute('data-placeholder');
      expect(value).not.toHaveAttribute('data-placeholder');
    });
  });

  describe('style hooks', () => {
    it.skipIf(isJSDOM)('sets data-popup-side to the current popup side', async () => {
      const { user } = await render(
        <Select.Root>
          <Select.Trigger data-testid="trigger">Trigger</Select.Trigger>
          <Select.Portal>
            <Select.Positioner side="right" alignItemWithTrigger={false}>
              <Select.Popup>
                <Select.Item value="apple">apple</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      expect(trigger).not.toHaveAttribute('data-popup-side');

      await user.click(trigger);

      await waitFor(() => expect(screen.queryByRole('listbox')).not.toBe(null));
      expect(trigger).toHaveAttribute('data-popup-side', 'right');

      await user.click(document.body);

      await waitFor(() => expect(screen.queryByRole('listbox')).toBe(null));
      expect(trigger).not.toHaveAttribute('data-popup-side');
    });

    it.skipIf(isJSDOM)(
      'sets data-popup-side to the resolved side when alignItemWithTrigger is active',
      async () => {
        const { user } = await render(
          <div style={{ paddingTop: 100, paddingLeft: 10 }}>
            <Select.Root defaultValue="apple">
              <Select.Trigger data-testid="trigger" style={{ width: 120, height: 36 }}>
                <Select.Value />
              </Select.Trigger>
              <Select.Portal>
                <Select.Positioner data-testid="positioner">
                  <Select.Popup style={{ maxHeight: 'none' }}>
                    <Select.Item value="apple">apple</Select.Item>
                    <Select.Item value="orange">orange</Select.Item>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </div>,
        );

        const trigger = screen.getByTestId('trigger');

        await user.click(trigger);

        await waitFor(() => {
          expect(screen.getByTestId('positioner')).toHaveAttribute('data-side', 'none');
          expect(trigger).toHaveAttribute('data-popup-side', 'bottom');
        });
      },
    );

    it('should have the data-popup-open and data-pressed attributes when open', async () => {
      const { user } = await render(
        <Select.Root>
          <Select.Trigger />
        </Select.Root>,
      );

      const trigger = screen.getByRole('combobox');

      await user.click(trigger);

      await waitFor(() => {
        expect(trigger).toHaveAttribute('data-popup-open');
      });
      expect(trigger).toHaveAttribute('data-pressed');
    });
  });

  describe('prop: required', () => {
    it('sets aria-required attribute when required', async () => {
      await render(
        <Select.Root required>
          <Select.Trigger data-testid="trigger" />
        </Select.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      expect(trigger).toHaveAttribute('aria-required', 'true');
    });
  });
});
