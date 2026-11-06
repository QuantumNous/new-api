import { expect, vi } from 'vitest';
import { Combobox } from '@base-ui/react/combobox';
import { createRenderer, describeConformance } from '#test-utils';
import { act, screen } from '@mui/internal-test-utils';

describe('<Combobox.ChipRemove />', () => {
  const { render } = createRenderer();

  describeConformance(<Combobox.ChipRemove />, () => ({
    refInstanceof: window.HTMLButtonElement,
    button: true,
    render(node) {
      return render(
        <Combobox.Root multiple>
          <Combobox.Chips>
            <Combobox.Chip>{node}</Combobox.Chip>
          </Combobox.Chips>
        </Combobox.Root>,
      );
    },
  }));

  it('throws a descriptive error when rendered outside <Combobox.Chip>', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      await expect(
        render(
          <Combobox.Root multiple>
            <Combobox.Chips>
              <Combobox.ChipRemove />
            </Combobox.Chips>
          </Combobox.Root>,
        ),
      ).rejects.toThrow(
        'Base UI: ComboboxChipContext is missing. ComboboxChip parts must be placed within <Combobox.Chip>.',
      );
    } finally {
      errorSpy.mockRestore();
    }
  });

  describe('prop: disabled', () => {
    it('should render disabled attribute when disabled', async () => {
      await render(
        <Combobox.Root multiple disabled>
          <Combobox.Chips>
            <Combobox.Chip>
              apple
              <Combobox.ChipRemove data-testid="remove">×</Combobox.ChipRemove>
            </Combobox.Chip>
          </Combobox.Chips>
        </Combobox.Root>,
      );

      const remove = screen.getByTestId('remove');
      expect(remove).toHaveAttribute('aria-disabled', 'true');
    });

    it('should not remove chip when disabled', async () => {
      const handleValueChange = vi.fn();
      const { user } = await render(
        <Combobox.Root
          multiple
          disabled
          defaultValue={['apple', 'banana']}
          onValueChange={handleValueChange}
        >
          <Combobox.Input data-testid="input" />
          <Combobox.Chips>
            <Combobox.Chip data-testid="chip-apple">
              apple
              <Combobox.ChipRemove data-testid="remove-apple" />
            </Combobox.Chip>
            <Combobox.Chip data-testid="chip-banana">
              banana
              <Combobox.ChipRemove data-testid="remove-banana" />
            </Combobox.Chip>
          </Combobox.Chips>
        </Combobox.Root>,
      );

      const removeApple = screen.getByTestId('remove-apple');

      await user.click(removeApple);

      expect(handleValueChange.mock.calls.length).toBe(0);
      expect(screen.getByTestId('chip-apple')).not.toBe(null);
    });
  });

  describe('prop: readOnly', () => {
    it('should not remove chip when readOnly', async () => {
      const handleValueChange = vi.fn();
      const { user } = await render(
        <Combobox.Root
          multiple
          readOnly
          defaultValue={['apple', 'banana']}
          onValueChange={handleValueChange}
        >
          <Combobox.Input data-testid="input" />
          <Combobox.Chips>
            <Combobox.Chip data-testid="chip-apple">
              apple
              <Combobox.ChipRemove data-testid="remove-apple" />
            </Combobox.Chip>
            <Combobox.Chip data-testid="chip-banana">
              banana
              <Combobox.ChipRemove data-testid="remove-banana" />
            </Combobox.Chip>
          </Combobox.Chips>
        </Combobox.Root>,
      );

      const removeApple = screen.getByTestId('remove-apple');

      await user.click(removeApple);

      expect(handleValueChange.mock.calls.length).toBe(0);
      expect(screen.getByTestId('chip-apple')).not.toBe(null);
    });

    it('should be focusable but not functional when readOnly', async () => {
      const { user } = await render(
        <Combobox.Root multiple readOnly>
          <Combobox.Chips>
            <Combobox.Chip>
              apple
              <Combobox.ChipRemove data-testid="remove" />
            </Combobox.Chip>
          </Combobox.Chips>
        </Combobox.Root>,
      );

      const remove = screen.getByTestId('remove');

      // Should be focusable
      await act(async () => {
        remove.focus();
      });
      expect(remove).toHaveFocus();

      // But should not trigger action
      await user.keyboard('{Enter}');
      expect(screen.getByTestId('remove')).not.toBe(null);
    });
  });

  describe('interaction behavior', () => {
    it('should remove chip on click when enabled', async () => {
      const handleValueChange = vi.fn();
      const { user } = await render(
        <Combobox.Root
          multiple
          defaultValue={['apple', 'banana']}
          onValueChange={handleValueChange}
        >
          <Combobox.Input data-testid="input" />
          <Combobox.Chips>
            <Combobox.Chip data-testid="chip-apple">
              apple
              <Combobox.ChipRemove data-testid="remove-apple" />
            </Combobox.Chip>
            <Combobox.Chip data-testid="chip-banana">
              banana
              <Combobox.ChipRemove data-testid="remove-banana" />
            </Combobox.Chip>
          </Combobox.Chips>
        </Combobox.Root>,
      );

      const removeApple = screen.getByTestId('remove-apple');

      await user.click(removeApple);

      expect(handleValueChange.mock.calls.length).toBe(1);
      expect(handleValueChange.mock.calls[0][0]).toEqual(['banana']);
    });

    it('should focus input after removing chip', async () => {
      const { user } = await render(
        <Combobox.Root multiple defaultValue={['apple']}>
          <Combobox.Input data-testid="input" />
          <Combobox.Chips>
            <Combobox.Chip>
              apple
              <Combobox.ChipRemove data-testid="remove" />
            </Combobox.Chip>
          </Combobox.Chips>
        </Combobox.Root>,
      );

      const remove = screen.getByTestId('remove');
      const input = screen.getByTestId('input');

      await user.click(remove);

      expect(input).toHaveFocus();
    });

    it('should keep the popup open while removing a chip', async () => {
      const { user } = await render(
        <Combobox.Root items={['apple', 'banana']} multiple defaultValue={['apple']}>
          <Combobox.Input data-testid="input" />
          <Combobox.Trigger>Open</Combobox.Trigger>
          <Combobox.Chips>
            <Combobox.Chip>
              apple
              <Combobox.ChipRemove data-testid="remove" />
            </Combobox.Chip>
          </Combobox.Chips>
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
      await screen.findByRole('listbox');

      await user.click(screen.getByTestId('remove'));

      await screen.findByRole('listbox');
      expect(screen.getByTestId('input')).toHaveFocus();
    });

    it('should prevent event propagation', async () => {
      const handleChipClick = vi.fn();
      const handleRemoveClick = vi.fn();
      const { user } = await render(
        <Combobox.Root multiple defaultValue={['apple']}>
          <Combobox.Input data-testid="input" />
          <Combobox.Chips>
            <Combobox.Chip onClick={handleChipClick}>
              apple
              <Combobox.ChipRemove data-testid="remove" onClick={handleRemoveClick} />
            </Combobox.Chip>
          </Combobox.Chips>
        </Combobox.Root>,
      );

      const remove = screen.getByTestId('remove');

      await user.click(remove);

      // Remove click should happen but not propagate to chip
      expect(handleRemoveClick.mock.calls.length).toBe(1);
      expect(handleChipClick.mock.calls.length).toBe(0);
    });

    it('should handle keyboard activation', async () => {
      const handleValueChange = vi.fn();
      const { user } = await render(
        <Combobox.Root
          multiple
          defaultValue={['apple', 'banana']}
          onValueChange={handleValueChange}
        >
          <Combobox.Input data-testid="input" />
          <Combobox.Chips>
            <Combobox.Chip>
              apple
              <Combobox.ChipRemove data-testid="remove">×</Combobox.ChipRemove>
            </Combobox.Chip>
            <Combobox.Chip>banana</Combobox.Chip>
          </Combobox.Chips>
        </Combobox.Root>,
      );

      const remove = screen.getByTestId('remove');

      await act(async () => {
        remove.focus();
      });
      await user.keyboard('{Enter}');

      expect(handleValueChange.mock.calls.length).toBe(1);
      expect(handleValueChange.mock.calls[0][0]).toEqual(['banana']);
    });

    it('should have proper tab index', async () => {
      await render(
        <Combobox.Root multiple>
          <Combobox.Chips>
            <Combobox.Chip>
              apple
              <Combobox.ChipRemove data-testid="remove">×</Combobox.ChipRemove>
            </Combobox.Chip>
          </Combobox.Chips>
        </Combobox.Root>,
      );

      const remove = screen.getByTestId('remove');
      expect(remove).toHaveAttribute('tabindex', '-1');
    });
  });
});
