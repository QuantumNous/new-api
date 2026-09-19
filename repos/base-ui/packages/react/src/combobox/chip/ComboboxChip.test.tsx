import { expect, vi } from 'vitest';
import * as React from 'react';
import { Combobox } from '@base-ui/react/combobox';
import { DirectionProvider } from '@base-ui/react/direction-provider';
import { createRenderer, describeConformance } from '#test-utils';
import { act, screen, waitFor } from '@mui/internal-test-utils';

describe('<Combobox.Chip />', () => {
  const { render } = createRenderer();

  describeConformance(<Combobox.Chip />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(
        <Combobox.Root multiple>
          <Combobox.Chips>{node}</Combobox.Chips>
        </Combobox.Root>,
      );
    },
  }));

  describe('prop: disabled', () => {
    it('should render aria-disabled attribute when disabled', async () => {
      await render(
        <Combobox.Root multiple disabled>
          <Combobox.Chips>
            <Combobox.Chip data-testid="chip">apple</Combobox.Chip>
          </Combobox.Chips>
        </Combobox.Root>,
      );

      const chip = screen.getByTestId('chip');
      expect(chip).toHaveAttribute('aria-disabled', 'true');
    });

    it('should prevent keyboard navigation when disabled', async () => {
      const { user } = await render(
        <Combobox.Root multiple disabled defaultValue={['apple', 'banana']}>
          <Combobox.Input data-testid="input" />
          <Combobox.Chips>
            <Combobox.Chip data-testid="chip-apple">apple</Combobox.Chip>
            <Combobox.Chip data-testid="chip-banana">banana</Combobox.Chip>
          </Combobox.Chips>
        </Combobox.Root>,
      );

      const chipApple = screen.getByTestId('chip-apple');

      // Focus the chip manually (simulating navigation)
      await act(async () => {
        chipApple.focus();
      });

      // Try to navigate with arrow keys
      await user.keyboard('{ArrowRight}');

      // The focus should remain on the same chip when disabled
      expect(chipApple).toHaveFocus();
    });

    it('should prevent deletion when disabled', async () => {
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
            <Combobox.Chip data-testid="chip-apple">apple</Combobox.Chip>
            <Combobox.Chip data-testid="chip-banana">banana</Combobox.Chip>
          </Combobox.Chips>
        </Combobox.Root>,
      );

      const chipApple = screen.getByTestId('chip-apple');

      // Focus the chip manually
      await act(async () => {
        chipApple.focus();
      });

      // Try to delete with backspace
      await user.keyboard('{Backspace}');

      expect(handleValueChange.mock.calls.length).toBe(0);
      expect(screen.getByTestId('chip-apple')).not.toBe(null);
    });

    it('should prevent mouse interactions when disabled', async () => {
      const { user } = await render(
        <Combobox.Root multiple disabled>
          <Combobox.Input data-testid="input" />
          <Combobox.Chips>
            <Combobox.Chip data-testid="chip">apple</Combobox.Chip>
          </Combobox.Chips>
        </Combobox.Root>,
      );

      const chip = screen.getByTestId('chip');
      const input = screen.getByTestId('input');

      // Chip should not focus input on mouse down when disabled
      await user.click(chip);
      expect(input).not.toHaveFocus();
    });

    it('should prevent focus when disabled', async () => {
      const { user } = await render(
        <Combobox.Root multiple disabled>
          <Combobox.Chips>
            <Combobox.Chip data-testid="chip">apple</Combobox.Chip>
          </Combobox.Chips>
        </Combobox.Root>,
      );

      const chip = screen.getByTestId('chip');
      await user.click(chip);

      expect(chip).not.toHaveFocus();
    });
  });

  describe('prop: readOnly', () => {
    it('should render aria-readonly attribute when readOnly', async () => {
      await render(
        <Combobox.Root multiple readOnly>
          <Combobox.Chips>
            <Combobox.Chip data-testid="chip">apple</Combobox.Chip>
          </Combobox.Chips>
        </Combobox.Root>,
      );

      const chip = screen.getByTestId('chip');
      expect(chip).toHaveAttribute('aria-readonly', 'true');
    });

    it('should prevent deletion when readOnly', async () => {
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
            <Combobox.Chip data-testid="chip-apple">apple</Combobox.Chip>
            <Combobox.Chip data-testid="chip-banana">banana</Combobox.Chip>
          </Combobox.Chips>
        </Combobox.Root>,
      );

      const chipApple = screen.getByTestId('chip-apple');

      // Focus the chip manually
      await act(async () => {
        chipApple.focus();
      });

      // Try to delete with backspace
      await user.keyboard('{Backspace}');

      expect(handleValueChange.mock.calls.length).toBe(0);
      expect(screen.getByTestId('chip-apple')).not.toBe(null);
    });

    it('should prevent navigation when readOnly and also prevent deletion', async () => {
      const { user } = await render(
        <Combobox.Root multiple readOnly defaultValue={['apple', 'banana']}>
          <Combobox.Input data-testid="input" />
          <Combobox.Chips>
            <Combobox.Chip data-testid="chip-apple">apple</Combobox.Chip>
            <Combobox.Chip data-testid="chip-banana">banana</Combobox.Chip>
          </Combobox.Chips>
        </Combobox.Root>,
      );

      const chipApple = screen.getByTestId('chip-apple');

      // Focus the first chip
      await act(async () => {
        chipApple.focus();
      });

      // Navigation should be blocked
      await user.keyboard('{ArrowRight}');
      expect(chipApple).toHaveFocus();

      // Deletion should be blocked
      await user.keyboard('{Delete}');
      expect(screen.getByTestId('chip-banana')).not.toBe(null);
    });

    it('should focus when readOnly', async () => {
      const { user } = await render(
        <Combobox.Root multiple readOnly>
          <Combobox.Chips>
            <Combobox.Chip data-testid="chip">apple</Combobox.Chip>
          </Combobox.Chips>
        </Combobox.Root>,
      );

      const chip = screen.getByTestId('chip');
      await user.click(chip);

      expect(chip).toHaveFocus();
    });
  });

  describe('interaction behavior', () => {
    it('does not dismiss the popup when clicking a chip (outsidePress is blocked)', async () => {
      const { user } = await render(
        <Combobox.Root multiple defaultOpen defaultValue={['apple', 'banana']}>
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
          <Combobox.Chips>
            <Combobox.Chip data-testid="chip-apple">apple</Combobox.Chip>
            <Combobox.Chip data-testid="chip-banana">banana</Combobox.Chip>
          </Combobox.Chips>
        </Combobox.Root>,
      );

      expect(screen.getByRole('listbox')).not.toBe(null);

      await user.click(screen.getByTestId('chip-apple'));

      expect(screen.getByRole('listbox')).not.toBe(null);
    });

    it('closes the popup when a chip receives focus', async () => {
      const { user } = await render(
        <Combobox.Root multiple defaultOpen defaultValue={['apple', 'banana']}>
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
          <Combobox.Chips>
            <Combobox.Chip data-testid="chip-apple">apple</Combobox.Chip>
            <Combobox.Chip data-testid="chip-banana">banana</Combobox.Chip>
          </Combobox.Chips>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');
      expect(screen.getByRole('listbox')).not.toBe(null);

      await user.click(input);
      const chipApple = screen.getByTestId('chip-apple');
      await act(async () => {
        chipApple.focus();
      });

      await waitFor(() => expect(screen.queryByRole('listbox')).toBe(null));
    });

    it('should handle keyboard navigation when enabled', async () => {
      const { user } = await render(
        <Combobox.Root multiple defaultValue={['apple', 'banana', 'cherry']}>
          <Combobox.Input data-testid="input" />
          <Combobox.Chips>
            <Combobox.Chip data-testid="chip-apple">apple</Combobox.Chip>
            <Combobox.Chip data-testid="chip-banana">banana</Combobox.Chip>
            <Combobox.Chip data-testid="chip-cherry">cherry</Combobox.Chip>
          </Combobox.Chips>
        </Combobox.Root>,
      );

      const chipApple = screen.getByTestId('chip-apple');
      const chipBanana = screen.getByTestId('chip-banana');
      const chipCherry = screen.getByTestId('chip-cherry');
      const input = screen.getByTestId('input');

      // Focus the first chip
      await act(async () => {
        chipApple.focus();
      });

      // Navigate right
      await user.keyboard('{ArrowRight}');
      expect(chipBanana).toHaveFocus();

      // Navigate right again
      await user.keyboard('{ArrowRight}');
      expect(chipCherry).toHaveFocus();

      // Navigate right at the end should focus input
      await user.keyboard('{ArrowRight}');
      expect(input).toHaveFocus();

      // Navigate left from first chip should also focus input
      await act(async () => {
        chipApple.focus();
      });
      await user.keyboard('{ArrowLeft}');
      expect(input).toHaveFocus();
    });

    it('mirrors chip keyboard navigation in RTL mode', async () => {
      const { user } = await render(
        <DirectionProvider direction="rtl">
          <Combobox.Root multiple defaultValue={['apple', 'banana']}>
            <Combobox.Chips>
              <Combobox.Chip data-testid="chip-apple">apple</Combobox.Chip>
              <Combobox.Chip data-testid="chip-banana">banana</Combobox.Chip>
              <Combobox.Input data-testid="input" />
            </Combobox.Chips>
          </Combobox.Root>
        </DirectionProvider>,
      );

      const chipApple = screen.getByTestId('chip-apple');
      const chipBanana = screen.getByTestId('chip-banana');
      const input = screen.getByTestId<HTMLInputElement>('input');

      await act(async () => {
        input.focus();
        input.setSelectionRange(0, 0);
      });

      await user.keyboard('{ArrowRight}');
      expect(chipBanana).toHaveFocus();

      await user.keyboard('{ArrowRight}');
      expect(chipApple).toHaveFocus();

      await user.keyboard('{ArrowRight}');
      expect(input).toHaveFocus();

      await act(async () => {
        chipApple.focus();
      });

      await user.keyboard('{ArrowLeft}');
      expect(chipBanana).toHaveFocus();

      await user.keyboard('{ArrowLeft}');
      expect(input).toHaveFocus();
    });

    it('should navigate through only rendered chips', async () => {
      const { user } = await render(
        <Combobox.Root multiple defaultValue={['apple', 'banana', 'cherry']}>
          <Combobox.Chips>
            <Combobox.Value>
              {(value: string[]) => (
                <React.Fragment>
                  {value.slice(0, 2).map((item) => (
                    <Combobox.Chip key={item} data-testid={`chip-${item}`}>
                      {item}
                    </Combobox.Chip>
                  ))}
                  <Combobox.Input data-testid="input" />
                </React.Fragment>
              )}
            </Combobox.Value>
          </Combobox.Chips>
        </Combobox.Root>,
      );

      const chipBanana = screen.getByTestId('chip-banana');
      const input = screen.getByTestId<HTMLInputElement>('input');

      await act(async () => {
        input.focus();
        input.setSelectionRange(0, 0);
      });

      await user.keyboard('{ArrowLeft}');
      expect(chipBanana).toHaveFocus();

      await user.keyboard('{ArrowRight}');
      expect(input).toHaveFocus();

      await act(async () => {
        chipBanana.focus();
      });

      await user.keyboard('{ArrowRight}');
      expect(input).toHaveFocus();
    });

    it('should handle deletion when enabled', async () => {
      const handleValueChange = vi.fn();
      const { user } = await render(
        <Combobox.Root
          multiple
          defaultValue={['apple', 'banana']}
          onValueChange={handleValueChange}
        >
          <Combobox.Input data-testid="input" />
          <Combobox.Chips>
            <Combobox.Chip data-testid="chip-apple">apple</Combobox.Chip>
            <Combobox.Chip data-testid="chip-banana">banana</Combobox.Chip>
          </Combobox.Chips>
        </Combobox.Root>,
      );

      const chipApple = screen.getByTestId('chip-apple');

      // Focus the chip and delete it
      await act(async () => {
        chipApple.focus();
      });
      await user.keyboard('{Backspace}');

      expect(handleValueChange.mock.calls.length).toBe(1);
      expect(handleValueChange.mock.calls[0][0]).toEqual(['banana']);
    });

    it('should focus input on mouse down when enabled', async () => {
      const { user } = await render(
        <Combobox.Root multiple>
          <Combobox.Input data-testid="input" />
          <Combobox.Chips>
            <Combobox.Chip data-testid="chip">apple</Combobox.Chip>
          </Combobox.Chips>
        </Combobox.Root>,
      );

      const chip = screen.getByTestId('chip');
      const input = screen.getByTestId('input');

      await user.click(chip);
      expect(input).toHaveFocus();
    });
  });
});
