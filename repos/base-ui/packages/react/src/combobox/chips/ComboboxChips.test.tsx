import { expect, vi } from 'vitest';
import { Combobox } from '@base-ui/react/combobox';
import { fireEvent, screen } from '@mui/internal-test-utils';
import { createRenderer, describeConformance } from '#test-utils';
import { Field } from '@base-ui/react/field';

describe('<Combobox.Chips />', () => {
  const { render } = createRenderer();

  describeConformance(<Combobox.Chips />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(<Combobox.Root>{node}</Combobox.Root>);
    },
  }));

  it('does not set role="toolbar" when there are no chips', async () => {
    await render(
      <Combobox.Root multiple>
        <Combobox.Chips data-testid="chips" />
      </Combobox.Root>,
    );

    const chips = screen.getByTestId('chips');
    expect(chips).not.toHaveAttribute('role');
  });

  it('sets role="toolbar" when there is at least one chip', async () => {
    await render(
      <Combobox.Root multiple defaultValue={['apple']}>
        <Combobox.Chips data-testid="chips">
          <Combobox.Chip>apple</Combobox.Chip>
        </Combobox.Chips>
      </Combobox.Root>,
    );

    const chips = screen.getByTestId('chips');
    expect(chips).toHaveAttribute('role', 'toolbar');
  });

  it('focuses the input when clicking anywhere in the Chips area', async () => {
    await render(
      <Combobox.Root multiple defaultValue={['apple']}>
        <Combobox.Chips data-testid="chips">
          <Combobox.Chip data-testid="chip">apple</Combobox.Chip>
          <Combobox.Input data-testid="input" />
        </Combobox.Chips>
      </Combobox.Root>,
    );

    const chips = screen.getByTestId('chips');
    const chip = screen.getByTestId('chip');
    const input = screen.getByTestId('input');

    expect(document.activeElement).not.toBe(input);

    fireEvent.mouseDown(chips);
    expect(input).toHaveFocus();

    // Blur and click on a chip: input should still receive focus.
    input.blur();
    expect(document.activeElement).not.toBe(input);
    fireEvent.mouseDown(chip);
    expect(input).toHaveFocus();
  });

  it('lets onMouseDown prevent the built-in focus and open behavior', async () => {
    const handleMouseDown = vi.fn();

    await render(
      <Combobox.Root items={['apple', 'banana']} multiple defaultValue={['apple']}>
        <Combobox.Chips
          data-testid="chips"
          onMouseDown={(event) => {
            handleMouseDown(event);
            event.preventBaseUIHandler();
          }}
        >
          <Combobox.Chip>apple</Combobox.Chip>
          <Combobox.Input data-testid="input" />
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

    const chips = screen.getByTestId('chips');
    const input = screen.getByTestId('input');

    fireEvent.mouseDown(chips);

    expect(handleMouseDown).toHaveBeenCalledTimes(1);
    expect(input).not.toHaveFocus();
    expect(screen.queryByRole('listbox')).toBe(null);
  });

  it('lets nested chip onMouseDown prevent the built-in focus and open behavior', async () => {
    const handleMouseDown = vi.fn();

    await render(
      <Combobox.Root items={['apple', 'banana']} multiple defaultValue={['apple']}>
        <Combobox.Chips data-testid="chips">
          <Combobox.Chip
            data-testid="chip"
            onMouseDown={(event) => {
              handleMouseDown(event);
              event.preventBaseUIHandler();
            }}
          >
            apple
          </Combobox.Chip>
          <Combobox.Input data-testid="input" />
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

    fireEvent.mouseDown(screen.getByTestId('chip'));

    expect(handleMouseDown).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('input')).not.toHaveFocus();
    expect(screen.queryByRole('listbox')).toBe(null);
  });

  it('lets nested chip onContextMenu call preventBaseUIHandler', async () => {
    const handleContextMenu = vi.fn();

    await render(
      <Combobox.Root items={['apple', 'banana']} multiple defaultValue={['apple']}>
        <Combobox.Chips>
          <Combobox.Chip
            data-testid="chip"
            onContextMenu={(event) => {
              handleContextMenu(event);
              event.preventBaseUIHandler();
            }}
          >
            apple
          </Combobox.Chip>
          <Combobox.Input />
        </Combobox.Chips>
      </Combobox.Root>,
    );

    expect(() => fireEvent.contextMenu(screen.getByTestId('chip'))).not.toThrow();
    expect(handleContextMenu).toHaveBeenCalledTimes(1);
  });

  it('does not treat chip remove presses as chips-area presses', async () => {
    await render(
      <Combobox.Root items={['apple', 'banana']} multiple defaultValue={['apple']}>
        <Combobox.Chips>
          <Combobox.Chip>
            apple
            <Combobox.ChipRemove data-testid="remove" />
          </Combobox.Chip>
          <Combobox.Input />
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

    fireEvent.mouseDown(screen.getByTestId('remove'));
    expect(screen.queryByRole('listbox')).toBe(null);
  });

  it('does not focus or open when disabled by Field.Root', async () => {
    await render(
      <Field.Root disabled>
        <Combobox.Root items={['apple', 'banana']} multiple defaultValue={['apple']}>
          <Combobox.Chips data-testid="chips">
            <Combobox.Chip>apple</Combobox.Chip>
            <Combobox.Input data-testid="input" />
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
        </Combobox.Root>
      </Field.Root>,
    );

    fireEvent.mouseDown(screen.getByTestId('chips'));

    expect(screen.getByTestId('input')).not.toHaveFocus();
    expect(screen.queryByRole('listbox')).toBe(null);
  });

  it('does not focus or open when readOnly', async () => {
    await render(
      <Combobox.Root items={['apple', 'banana']} multiple readOnly defaultValue={['apple']}>
        <Combobox.Chips data-testid="chips">
          <Combobox.Chip>apple</Combobox.Chip>
          <Combobox.Input data-testid="input" />
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

    fireEvent.mouseDown(screen.getByTestId('chips'));

    expect(screen.getByTestId('input')).not.toHaveFocus();
    expect(screen.queryByRole('listbox')).toBe(null);
  });
});
