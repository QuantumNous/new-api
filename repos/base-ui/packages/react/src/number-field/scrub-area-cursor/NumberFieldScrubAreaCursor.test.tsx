import { expect, vi } from 'vitest';
import * as React from 'react';
import { screen, act } from '@mui/internal-test-utils';
import { NumberField } from '@base-ui/react/number-field';
import { platform } from '@base-ui/utils/platform';
import { createRenderer, describeConformance } from '#test-utils';
import { NumberFieldScrubAreaContext } from '../scrub-area/NumberFieldScrubAreaContext';

const isWebKit = platform.engine.webkit;

const defaultScrubAreaContext: NumberFieldScrubAreaContext = {
  isScrubbing: true,
  isTouchInput: false,
  isPointerLockDenied: false,
  scrubAreaCursorRef: React.createRef<HTMLSpanElement>(),
};

// This component doesn't render on WebKit.
describe.skipIf(isWebKit)('<NumberField.ScrubAreaCursor />', () => {
  const { render } = createRenderer();

  describeConformance(<NumberField.ScrubAreaCursor />, () => ({
    refInstanceof: window.HTMLSpanElement,
    render(node) {
      return render(
        <NumberField.Root>
          <NumberField.ScrubArea>
            <NumberFieldScrubAreaContext.Provider value={defaultScrubAreaContext}>
              {node}
            </NumberFieldScrubAreaContext.Provider>
          </NumberField.ScrubArea>
        </NumberField.Root>,
      );
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

  it('renders when using mouse input', async () => {
    const originalRequestPointerLock = Element.prototype.requestPointerLock;

    try {
      Element.prototype.requestPointerLock = vi.fn().mockResolvedValue(undefined);

      const { user } = await render(
        <NumberField.Root>
          <NumberField.Input />
          <NumberField.ScrubArea data-testid="scrub-area">
            <NumberField.ScrubAreaCursor data-testid="scrub-area-cursor" />
          </NumberField.ScrubArea>
        </NumberField.Root>,
      );

      const scrubArea = screen.getByTestId('scrub-area');

      await act(async () => {
        await user.pointer({ target: scrubArea, keys: '[MouseLeft>]', pointerName: 'mouse' });
        await new Promise((resolve) => {
          setTimeout(resolve, 25);
        });
      });

      expect(screen.queryByTestId('scrub-area-cursor')).not.toBe(null);
    } finally {
      Element.prototype.requestPointerLock = originalRequestPointerLock;
    }
  });

  it('only renders a cursor for the active scrub area', async () => {
    const originalRequestPointerLock = Element.prototype.requestPointerLock;

    try {
      Element.prototype.requestPointerLock = vi.fn().mockResolvedValue(undefined);

      const { user } = await render(
        <NumberField.Root>
          <NumberField.Input />
          <NumberField.ScrubArea data-testid="scrub-area-1">
            <NumberField.ScrubAreaCursor data-testid="scrub-area-cursor" />
          </NumberField.ScrubArea>
          <NumberField.ScrubArea data-testid="scrub-area-2">
            <NumberField.ScrubAreaCursor data-testid="scrub-area-cursor" />
          </NumberField.ScrubArea>
        </NumberField.Root>,
      );

      const firstScrubArea = screen.getByTestId('scrub-area-1');

      await act(async () => {
        await user.pointer({ target: firstScrubArea, keys: '[MouseLeft>]', pointerName: 'mouse' });
        await new Promise((resolve) => {
          setTimeout(resolve, 25);
        });
      });

      expect(screen.queryAllByTestId('scrub-area-cursor')).toHaveLength(1);
    } finally {
      Element.prototype.requestPointerLock = originalRequestPointerLock;
    }
  });

  it('does not render when using touch input', async () => {
    const { user } = await render(
      <NumberField.Root>
        <NumberField.ScrubArea>
          <NumberField.ScrubAreaCursor data-testid="scrub-area-cursor" />
        </NumberField.ScrubArea>
      </NumberField.Root>,
    );

    const scrubArea = screen.getByRole('presentation');

    await act(async () => {
      await user.pointer({ target: scrubArea, keys: '[TouchA>]', pointerName: 'touch' });
      await new Promise((resolve) => {
        setTimeout(resolve, 25);
      });
    });

    expect(screen.queryByTestId('scrub-area-cursor')).toBe(null);
  });

  it('handles pointer lock denial through requestPointerLock API', async () => {
    const originalRequestPointerLock = Element.prototype.requestPointerLock;

    try {
      const requestLockStub = vi.fn(() => {
        throw new Error('User denied pointer lock');
      });
      Element.prototype.requestPointerLock =
        requestLockStub as typeof Element.prototype.requestPointerLock;

      const { user } = await render(
        <NumberField.Root>
          <NumberField.ScrubArea>
            <NumberField.ScrubAreaCursor data-testid="scrub-area-cursor" />
          </NumberField.ScrubArea>
        </NumberField.Root>,
      );

      const scrubArea = screen.getByRole('presentation');

      await act(async () => {
        await user.pointer({ target: scrubArea, keys: '[MouseLeft>]', pointerName: 'mouse' });
        await new Promise((resolve) => {
          setTimeout(resolve, 25);
        });
      });

      expect(screen.queryByTestId('scrub-area-cursor')).toBe(null);
      expect(requestLockStub).toHaveBeenCalled();
    } finally {
      Element.prototype.requestPointerLock = originalRequestPointerLock;
    }
  });

  it('does not render after a quick tap when pointer lock resolves later', async () => {
    const originalRequestPointerLock = Element.prototype.requestPointerLock;

    try {
      // Simulate pointer lock resolving after the user already released the pointer (tap)
      Element.prototype.requestPointerLock = vi.fn().mockReturnValue(
        new Promise((resolve) => {
          setTimeout(resolve, 30);
        }),
      );

      const { user } = await render(
        <NumberField.Root>
          <NumberField.Input />
          <NumberField.ScrubArea data-testid="scrub-area">
            <NumberField.ScrubAreaCursor data-testid="scrub-area-cursor" />
          </NumberField.ScrubArea>
        </NumberField.Root>,
      );

      const scrubArea = screen.getByTestId('scrub-area');

      await act(async () => {
        // Quick press and release (tap)
        await user.pointer({ target: scrubArea, keys: '[MouseLeft>]', pointerName: 'mouse' });
        await user.pointer({ target: scrubArea, keys: '[/MouseLeft]', pointerName: 'mouse' });
        window.dispatchEvent(new Event('pointerup'));
        // Wait longer than the delayed pointer lock resolution
        await new Promise((resolve) => {
          setTimeout(resolve, 50);
        });
      });

      // After a tap, the scrub cursor should not remain rendered
      expect(screen.queryByTestId('scrub-area-cursor')).toBe(null);
    } finally {
      Element.prototype.requestPointerLock = originalRequestPointerLock;
    }
  });
});
