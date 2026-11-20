import { expect, vi } from 'vitest';
import { screen, act, fireEvent } from '@mui/internal-test-utils';
import { NumberField } from '@base-ui/react/number-field';
import { createRenderer, describeConformance, isJSDOM } from '#test-utils';
import { platform } from '@base-ui/utils/platform';

const isWebKit = platform.engine.webkit;

// TODO (@Janpot): Contribute https://github.com/testing-library/user-event/issues/903 and
// rely on `user.pointer()` instead.
let currentPos = { clientX: 0, clientY: 0 };

function createPointerDownEvent(elm: HTMLElement) {
  const box = elm.getBoundingClientRect();
  const centerX = box.left + box.width / 2;
  const centerY = box.top + box.height / 2;
  currentPos = { clientX: centerX, clientY: centerY };
  return new PointerEvent('pointerdown', {
    bubbles: true,
    ...currentPos,
  });
}

function createPointerMoveEvent({ movementX = 0, movementY = 0 }) {
  currentPos = {
    clientX: currentPos.clientX + movementX,
    clientY: currentPos.clientY + movementY,
  };
  return new PointerEvent('pointermove', {
    bubbles: true,
    ...currentPos,
    movementX,
    movementY,
  });
}

describe('<NumberField.ScrubArea />', () => {
  const { render } = createRenderer();

  function createClipboardData(text: string) {
    return {
      getData: (type: string) => (type === 'text/plain' ? text : ''),
    };
  }

  function pasteText(target: HTMLElement, value: string) {
    if (isJSDOM) {
      fireEvent.paste(target, {
        clipboardData: createClipboardData(value),
      });
      return;
    }

    const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(pasteEvent, 'clipboardData', {
      value: createClipboardData(value),
    });

    fireEvent(target, pasteEvent);
  }

  describeConformance(<NumberField.ScrubArea />, () => ({
    refInstanceof: window.HTMLSpanElement,
    render: async (node) => {
      return render(<NumberField.Root>{node}</NumberField.Root>);
    },
  }));

  it('has presentation role', async () => {
    await render(
      <NumberField.Root>
        <NumberField.ScrubArea />
      </NumberField.Root>,
    );
    expect(screen.queryByRole('presentation')).not.toBe(null);
  });

  // Only run the following tests in Chromium/Firefox.
  if (isJSDOM || isWebKit) {
    return;
  }

  it('should increment or decrement the value when scrubbing with the pointer', async () => {
    await render(
      <NumberField.Root defaultValue={0}>
        <NumberField.Input />
        <NumberField.ScrubArea data-testid="scrub-area">
          <NumberField.ScrubAreaCursor />
        </NumberField.ScrubArea>
      </NumberField.Root>,
    );

    const scrubArea = screen.getByTestId('scrub-area');
    const input = screen.getByRole('textbox');

    await act(async () => {
      scrubArea.dispatchEvent(createPointerDownEvent(scrubArea));
      scrubArea.dispatchEvent(createPointerMoveEvent({ movementX: -10 }));
    });

    expect(input).toHaveValue('-10');
    await act(async () => {
      scrubArea.dispatchEvent(createPointerMoveEvent({ movementX: 5 }));
    });

    expect(input).toHaveValue('-5');

    await act(async () => {
      scrubArea.dispatchEvent(createPointerMoveEvent({ movementX: -2 }));
    });

    expect(input).toHaveValue('-7');
  });

  it('clears the root scrubbing state when the scrub area unmounts mid-scrub', async () => {
    function App(props: { scrubAreaMounted: boolean }) {
      return (
        <NumberField.Root defaultValue={0} data-testid="root">
          <NumberField.Input />
          {props.scrubAreaMounted && (
            <NumberField.ScrubArea data-testid="scrub-area">
              <NumberField.ScrubAreaCursor />
            </NumberField.ScrubArea>
          )}
        </NumberField.Root>
      );
    }

    const { setProps } = await render(<App scrubAreaMounted />);

    const scrubArea = screen.getByTestId('scrub-area');
    const root = screen.getByTestId('root');

    await act(async () => {
      scrubArea.dispatchEvent(createPointerDownEvent(scrubArea));
      scrubArea.dispatchEvent(createPointerMoveEvent({ movementX: -10 }));
    });

    expect(root).toHaveAttribute('data-scrubbing');

    // Unmount the scrub area before pointerup; the root must not stay stuck in the scrubbing state.
    await act(async () => {
      setProps({ scrubAreaMounted: false });
    });

    expect(root).not.toHaveAttribute('data-scrubbing');
  });

  it('syncs the visible input value when scrubbing after pasting', async () => {
    const onValueChange = vi.fn();

    await render(
      <NumberField.Root defaultValue={10} onValueChange={onValueChange}>
        <NumberField.Input />
        <NumberField.ScrubArea data-testid="scrub-area">
          <NumberField.ScrubAreaCursor />
        </NumberField.ScrubArea>
      </NumberField.Root>,
    );

    const scrubArea = screen.getByTestId('scrub-area');
    const input = screen.getByRole('textbox') as HTMLInputElement;

    // Select the existing value so the paste replaces it rather than inserting at the caret.
    await act(async () => input.focus());
    input.select();
    pasteText(input, '20');

    expect(input).toHaveValue('20');
    expect(onValueChange.mock.lastCall?.[0]).toBe(20);

    await act(async () => {
      scrubArea.dispatchEvent(createPointerDownEvent(scrubArea));
      scrubArea.dispatchEvent(createPointerMoveEvent({ movementX: 2 }));
    });

    expect(onValueChange.mock.lastCall?.[0]).toBe(22);
    expect(input).toHaveValue('22');
  });

  it('calls onValueChange while scrubbing and onValueCommitted on pointerup', async () => {
    const onValueChange = vi.fn();
    const onValueCommitted = vi.fn();

    await render(
      <NumberField.Root
        defaultValue={0}
        onValueChange={onValueChange}
        onValueCommitted={onValueCommitted}
      >
        <NumberField.Input />
        <NumberField.ScrubArea data-testid="scrub-area">
          <NumberField.ScrubAreaCursor />
        </NumberField.ScrubArea>
      </NumberField.Root>,
    );

    const scrubArea = screen.getByTestId('scrub-area');

    await act(async () => {
      scrubArea.dispatchEvent(createPointerDownEvent(scrubArea));
      scrubArea.dispatchEvent(createPointerMoveEvent({ movementX: 3 }));
    });

    // One or more changes depending on pixel sensitivity and environment
    expect(onValueChange.mock.calls.length).toBeGreaterThan(0);

    await act(async () => {
      window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    });

    expect(onValueCommitted.mock.calls.length).toBe(1);

    const lastChange = onValueChange.mock.lastCall?.[0];
    const committed = onValueCommitted.mock.calls[0][0];
    expect(committed).toBe(lastChange);
  });

  describe('prop: pixelSensitivity', () => {
    it('should only increment if the pointer movement was greater than or equal to the value', async () => {
      await render(
        <NumberField.Root defaultValue={0}>
          <NumberField.Input />
          <NumberField.ScrubArea data-testid="scrub-area" pixelSensitivity={5}>
            <NumberField.ScrubAreaCursor />
          </NumberField.ScrubArea>
        </NumberField.Root>,
      );

      const scrubArea = screen.getByTestId('scrub-area');
      const input = screen.getByRole('textbox');

      await act(async () => {
        scrubArea.dispatchEvent(createPointerDownEvent(scrubArea));
        scrubArea.dispatchEvent(createPointerMoveEvent({ movementX: -2 }));
      });

      expect(input).toHaveValue('0');

      await act(async () => {
        scrubArea.dispatchEvent(createPointerMoveEvent({ movementX: 2 }));
      });

      expect(input).toHaveValue('0');

      await act(async () => {
        scrubArea.dispatchEvent(createPointerMoveEvent({ movementX: 1 }));
        scrubArea.dispatchEvent(createPointerMoveEvent({ movementX: 1 }));
        scrubArea.dispatchEvent(createPointerMoveEvent({ movementX: 1 }));
        scrubArea.dispatchEvent(createPointerMoveEvent({ movementX: 1 }));
      });

      expect(input).toHaveValue('0');

      await act(async () => {
        scrubArea.dispatchEvent(createPointerMoveEvent({ movementX: 1 }));
      });

      expect(input).toHaveValue('1');

      await act(async () => {
        scrubArea.dispatchEvent(createPointerMoveEvent({ movementX: 5 }));
      });

      expect(input).toHaveValue('6');

      await act(async () => {
        scrubArea.dispatchEvent(createPointerMoveEvent({ movementX: -4 }));
      });

      expect(input).toHaveValue('6');

      await act(async () => {
        scrubArea.dispatchEvent(createPointerMoveEvent({ movementX: -1 }));
      });

      expect(input).toHaveValue('5');

      await act(async () => {
        scrubArea.dispatchEvent(createPointerMoveEvent({ movementX: 5 }));
      });

      expect(input).toHaveValue('10');
    });
  });

  describe('prop: direction', () => {
    it('should only scrub if the pointer moved in the given direction', async () => {
      await render(
        <NumberField.Root defaultValue={0}>
          <NumberField.Input />
          <NumberField.ScrubArea data-testid="scrub-area" direction="horizontal">
            <NumberField.ScrubAreaCursor />
          </NumberField.ScrubArea>
        </NumberField.Root>,
      );

      const scrubArea = screen.getByTestId('scrub-area');
      const input = screen.getByRole('textbox');

      await act(async () => {
        scrubArea.dispatchEvent(createPointerDownEvent(scrubArea));
        scrubArea.dispatchEvent(createPointerMoveEvent({ movementX: 10 }));
      });

      expect(input).toHaveValue('10');

      await act(async () => {
        scrubArea.dispatchEvent(createPointerMoveEvent({ movementY: 10 }));
      });

      expect(input).toHaveValue('10');
    });
  });

  it('should fire onClick when clicked without scrubbing', async () => {
    const handleClick = vi.fn();

    const { user } = await render(
      <NumberField.Root defaultValue={0}>
        <NumberField.ScrubArea data-testid="scrub-area" onClick={handleClick}>
          <NumberField.ScrubAreaCursor />
        </NumberField.ScrubArea>
      </NumberField.Root>,
    );

    await user.click(screen.getByTestId('scrub-area'));

    expect(handleClick.mock.calls.length).toBe(1);
  });

  it('should fire onClick on child elements', async () => {
    const handleScrubAreaClick = vi.fn();
    const handleLabelClick = vi.fn();

    const { user } = await render(
      <NumberField.Root defaultValue={0}>
        <NumberField.ScrubArea onClick={handleScrubAreaClick}>
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
          <label onClick={handleLabelClick}>Amount</label>
          <NumberField.ScrubAreaCursor />
        </NumberField.ScrubArea>
      </NumberField.Root>,
    );

    await user.click(screen.getByText('Amount'));

    expect(handleLabelClick.mock.calls.length).toBe(1);
    expect(handleScrubAreaClick.mock.calls.length).toBe(1);
  });
});
