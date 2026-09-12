import { expect } from 'vitest';
import { createRenderer } from '#test-utils';
import { ScrollArea } from '@base-ui/react/scroll-area';
import { fireEvent, screen, waitFor } from '@mui/internal-test-utils';
import { describeConformance } from '../../../test/describeConformance';
import { SCROLL_TIMEOUT } from '../constants';

describe('<ScrollArea.Thumb />', () => {
  const { render } = createRenderer();

  describeConformance(<ScrollArea.Thumb />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(
        <ScrollArea.Root>
          <ScrollArea.Scrollbar keepMounted>{node}</ScrollArea.Scrollbar>
        </ScrollArea.Root>,
      );
    },
  }));

  it('clears scrolling state on pointer cancel without releasing stale capture', async () => {
    await render(
      <ScrollArea.Root style={{ width: 200, height: 200 }}>
        <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
          <div style={{ width: 200, height: 1000 }} />
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar orientation="vertical" data-testid="scrollbar" keepMounted>
          <ScrollArea.Thumb data-testid="thumb" />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>,
    );

    const viewport = screen.getByTestId('viewport');
    const scrollbar = screen.getByTestId('scrollbar');
    const thumb = screen.getByTestId('thumb');

    Object.defineProperties(viewport, {
      clientHeight: {
        configurable: true,
        value: 200,
      },
      scrollHeight: {
        configurable: true,
        value: 1000,
      },
      scrollTop: {
        configurable: true,
        writable: true,
        value: 0,
      },
    });

    Object.defineProperties(scrollbar, {
      offsetHeight: {
        configurable: true,
        value: 200,
      },
    });

    Object.defineProperties(thumb, {
      offsetHeight: {
        configurable: true,
        value: 40,
      },
      setPointerCapture: {
        configurable: true,
        value: () => {},
      },
      hasPointerCapture: {
        configurable: true,
        value: () => false,
      },
      releasePointerCapture: {
        configurable: true,
        value: () => {
          throw new Error('releasePointerCapture should not be called');
        },
      },
    });

    fireEvent.pointerDown(thumb, { button: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(thumb, { clientY: 20, pointerId: 1 });

    await waitFor(() => expect(scrollbar).toHaveAttribute('data-scrolling'));

    expect(() => fireEvent.pointerCancel(thumb, { pointerId: 1 })).not.toThrow();

    await waitFor(() => expect(scrollbar).not.toHaveAttribute('data-scrolling'));
  });

  it('clears horizontal scrolling state on pointer cancel', async () => {
    await render(
      <ScrollArea.Root style={{ width: 200, height: 200 }}>
        <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
          <div style={{ width: 1000, height: 200 }} />
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar orientation="horizontal" data-testid="scrollbar" keepMounted>
          <ScrollArea.Thumb data-testid="thumb" />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>,
    );

    const viewport = screen.getByTestId('viewport');
    const scrollbar = screen.getByTestId('scrollbar');
    const thumb = screen.getByTestId('thumb');

    Object.defineProperties(viewport, {
      clientWidth: {
        configurable: true,
        value: 200,
      },
      scrollWidth: {
        configurable: true,
        value: 1000,
      },
      scrollLeft: {
        configurable: true,
        writable: true,
        value: 0,
      },
    });

    Object.defineProperties(scrollbar, {
      offsetWidth: {
        configurable: true,
        value: 200,
      },
    });

    Object.defineProperties(thumb, {
      offsetWidth: {
        configurable: true,
        value: 40,
      },
      setPointerCapture: {
        configurable: true,
        value: () => {},
      },
      hasPointerCapture: {
        configurable: true,
        value: () => false,
      },
      releasePointerCapture: {
        configurable: true,
        value: () => {
          throw new Error('releasePointerCapture should not be called');
        },
      },
    });

    fireEvent.pointerDown(thumb, { button: 0, clientX: 0, pointerId: 1 });
    fireEvent.pointerMove(thumb, { clientX: 20, pointerId: 1 });

    await waitFor(() => expect(scrollbar).toHaveAttribute('data-scrolling'));

    expect(() => fireEvent.pointerCancel(thumb, { pointerId: 1 })).not.toThrow();

    await waitFor(() => expect(scrollbar).not.toHaveAttribute('data-scrolling'));
  });

  describe('data-scrolling attribute', () => {
    const { render: renderWithClock, clock } = createRenderer();

    clock.withFakeTimers();

    it('adds [data-scrolling] attribute when viewport is scrolled in the correct direction', async () => {
      await renderWithClock(
        <ScrollArea.Root style={{ width: 200, height: 200 }}>
          <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
            <div style={{ width: 1000, height: 1000 }} />
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar orientation="vertical" keepMounted>
            <ScrollArea.Thumb data-testid="vertical" />
          </ScrollArea.Scrollbar>
          <ScrollArea.Scrollbar orientation="horizontal" keepMounted>
            <ScrollArea.Thumb data-testid="horizontal" />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>,
      );

      const verticalThumb = screen.getByTestId('vertical');
      const horizontalThumb = screen.getByTestId('horizontal');
      const viewport = screen.getByTestId('viewport');

      expect(verticalThumb).not.toHaveAttribute('data-scrolling');
      expect(horizontalThumb).not.toHaveAttribute('data-scrolling');

      fireEvent.pointerEnter(viewport);
      fireEvent.scroll(viewport, {
        target: {
          scrollTop: 1,
        },
      });

      expect(verticalThumb).toHaveAttribute('data-scrolling', '');
      expect(horizontalThumb).not.toHaveAttribute('data-scrolling');

      await clock.tickAsync(SCROLL_TIMEOUT - 1);

      expect(verticalThumb).toHaveAttribute('data-scrolling', '');
      expect(horizontalThumb).not.toHaveAttribute('data-scrolling');

      fireEvent.pointerEnter(viewport);
      fireEvent.scroll(viewport, {
        target: {
          scrollLeft: 1,
        },
      });

      await clock.tickAsync(1);

      expect(verticalThumb).not.toHaveAttribute('data-scrolling');
      expect(horizontalThumb).toHaveAttribute('data-scrolling');

      await clock.tickAsync(SCROLL_TIMEOUT - 2);

      expect(verticalThumb).not.toHaveAttribute('data-scrolling');
      expect(horizontalThumb).toHaveAttribute('data-scrolling');

      await clock.tickAsync(1);

      expect(verticalThumb).not.toHaveAttribute('data-scrolling');
      expect(horizontalThumb).not.toHaveAttribute('data-scrolling');
    });
  });
});
