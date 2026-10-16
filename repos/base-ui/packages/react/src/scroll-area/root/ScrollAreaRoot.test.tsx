import { expect } from 'vitest';
import * as React from 'react';
import { ScrollArea } from '@base-ui/react/scroll-area';
import { act, fireEvent, flushMicrotasks, screen, waitFor } from '@mui/internal-test-utils';
import { createRenderer, isJSDOM } from '#test-utils';
import { describeConformance } from '../../../test/describeConformance';
import { DirectionProvider } from '../../direction-provider/DirectionProvider';
import { SCROLL_TIMEOUT } from '../constants';

const VIEWPORT_SIZE = 200;
const SCROLLABLE_CONTENT_SIZE = 1000;
const SCROLLBAR_WIDTH = 10;
const SCROLLBAR_HEIGHT = 10;

async function withMockResizeObserver(test: (notifyResizeObserver: () => void) => Promise<void>) {
  const originalResizeObserver = window.ResizeObserver;
  let notifyResizeObserver: (() => void) | null = null;

  class ResizeObserverMock implements ResizeObserver {
    callback: ResizeObserverCallback;

    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }

    observe() {
      notifyResizeObserver = () => {
        this.callback([], this);
      };
    }

    unobserve() {}

    disconnect() {}

    takeRecords() {
      return [];
    }
  }

  window.ResizeObserver = ResizeObserverMock;

  try {
    await test(() => {
      expect(notifyResizeObserver).not.toBe(null);
      notifyResizeObserver?.();
    });
  } finally {
    window.ResizeObserver = originalResizeObserver;
  }
}

describe('<ScrollArea.Root />', () => {
  const { render } = createRenderer();

  describeConformance(<ScrollArea.Root />, () => ({
    refInstanceof: window.HTMLDivElement,
    render,
  }));

  describe('data-scrolling attribute', () => {
    const { render: renderWithClock, clock } = createRenderer();

    clock.withFakeTimers();

    it('adds [data-scrolling] attribute when viewport is scrolled', async () => {
      await renderWithClock(
        <ScrollArea.Root data-testid="root" style={{ width: 200, height: 200 }}>
          <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
            <div style={{ width: 1000, height: 1000 }} />
          </ScrollArea.Viewport>
        </ScrollArea.Root>,
      );

      const root = screen.getByTestId('root');
      const viewport = screen.getByTestId('viewport');

      expect(root).not.toHaveAttribute('data-scrolling');

      fireEvent.pointerEnter(viewport);
      fireEvent.scroll(viewport, { target: { scrollTop: 1 } });

      expect(root).toHaveAttribute('data-scrolling', '');

      await clock.tickAsync(SCROLL_TIMEOUT);

      expect(root).not.toHaveAttribute('data-scrolling');

      // Test horizontal scrolling
      fireEvent.pointerEnter(viewport);
      fireEvent.scroll(viewport, { target: { scrollLeft: 1 } });

      expect(root).toHaveAttribute('data-scrolling', '');

      await clock.tickAsync(SCROLL_TIMEOUT);

      expect(root).not.toHaveAttribute('data-scrolling');
    });
  });

  describe.skipIf(isJSDOM)('sizing', () => {
    it('recomputes thumb size when becoming visible without requiring scroll', async () => {
      function App() {
        const [visible, setVisible] = React.useState(false);

        return (
          <React.Fragment>
            <button type="button" onClick={() => setVisible(true)}>
              show
            </button>
            <div style={{ display: visible ? 'block' : 'none' }}>
              <ScrollArea.Root style={{ width: VIEWPORT_SIZE, height: VIEWPORT_SIZE }}>
                <ScrollArea.Viewport
                  data-testid="viewport"
                  style={{ width: '100%', height: '100%' }}
                >
                  <div
                    style={{ width: SCROLLABLE_CONTENT_SIZE, height: SCROLLABLE_CONTENT_SIZE }}
                  />
                </ScrollArea.Viewport>
                <ScrollArea.Scrollbar orientation="vertical" style={{ display: 'flex' }}>
                  <ScrollArea.Thumb data-testid="vertical-thumb" style={{ paddingBlock: 8 }} />
                </ScrollArea.Scrollbar>
              </ScrollArea.Root>
            </div>
          </React.Fragment>
        );
      }

      await render(<App />);

      fireEvent.click(screen.getByRole('button', { name: 'show' }));

      const verticalThumb = await screen.findByTestId('vertical-thumb');

      await waitFor(() => {
        expect(
          getComputedStyle(verticalThumb).getPropertyValue('--scroll-area-thumb-height'),
        ).not.toBe('0px');
      });
    });

    it('shows scrollbars after mount compute before the first ResizeObserver measurement', async () => {
      await withMockResizeObserver(async (notifyResizeObserver) => {
        await render(
          <ScrollArea.Root style={{ width: VIEWPORT_SIZE, height: VIEWPORT_SIZE }}>
            <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
              <div style={{ width: SCROLLABLE_CONTENT_SIZE, height: SCROLLABLE_CONTENT_SIZE }} />
            </ScrollArea.Viewport>
            <ScrollArea.Scrollbar orientation="vertical" data-testid="vertical-scrollbar">
              <ScrollArea.Thumb data-testid="vertical-thumb" />
            </ScrollArea.Scrollbar>
          </ScrollArea.Root>,
        );

        const verticalScrollbar = await screen.findByTestId('vertical-scrollbar');

        await waitFor(() => {
          expect(getComputedStyle(verticalScrollbar).visibility).toBe('visible');
        });

        await act(async () => {
          notifyResizeObserver();
        });

        await waitFor(() => {
          expect(getComputedStyle(verticalScrollbar).visibility).toBe('visible');
        });
      });
    });

    it('shows keepMounted scrollbar track and thumb after mount compute', async () => {
      await withMockResizeObserver(async (notifyResizeObserver) => {
        await render(
          <ScrollArea.Root style={{ width: VIEWPORT_SIZE, height: VIEWPORT_SIZE }}>
            <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
              <div style={{ width: SCROLLABLE_CONTENT_SIZE, height: SCROLLABLE_CONTENT_SIZE }} />
            </ScrollArea.Viewport>
            <ScrollArea.Scrollbar
              orientation="vertical"
              data-testid="vertical-scrollbar"
              keepMounted
            >
              <ScrollArea.Thumb data-testid="vertical-thumb" />
            </ScrollArea.Scrollbar>
          </ScrollArea.Root>,
        );

        const verticalScrollbar = await screen.findByTestId('vertical-scrollbar');
        const verticalThumb = await screen.findByTestId('vertical-thumb');

        await waitFor(() => {
          expect(getComputedStyle(verticalScrollbar).visibility).toBe('visible');
          expect(getComputedStyle(verticalThumb).visibility).toBe('visible');
        });

        await act(async () => {
          notifyResizeObserver();
        });

        await waitFor(() => {
          expect(getComputedStyle(verticalScrollbar).visibility).toBe('visible');
          expect(getComputedStyle(verticalThumb).visibility).toBe('visible');
        });
      });
    });

    it('recomputes corner size when content starts overflowing', async () => {
      await withMockResizeObserver(async (notifyResizeObserver) => {
        const renderArea = (contentSize: number) => (
          <ScrollArea.Root style={{ width: VIEWPORT_SIZE, height: VIEWPORT_SIZE }}>
            <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
              <div style={{ width: contentSize, height: contentSize }} />
            </ScrollArea.Viewport>
            <ScrollArea.Scrollbar
              orientation="vertical"
              data-testid="scrollbar-vertical"
              style={{ width: 11 }}
            >
              <ScrollArea.Thumb />
            </ScrollArea.Scrollbar>
            <ScrollArea.Scrollbar
              orientation="horizontal"
              data-testid="scrollbar-horizontal"
              style={{ height: 13 }}
            >
              <ScrollArea.Thumb />
            </ScrollArea.Scrollbar>
            <ScrollArea.Corner data-testid="corner" />
          </ScrollArea.Root>
        );

        const { rerender } = await render(renderArea(VIEWPORT_SIZE / 2));

        await act(async () => {
          notifyResizeObserver();
        });

        expect(screen.queryByTestId('corner')).toBe(null);

        await rerender(renderArea(SCROLLABLE_CONTENT_SIZE));

        await act(async () => {
          notifyResizeObserver();
        });

        await waitFor(() => {
          const corner = screen.getByTestId('corner');
          expect(corner.style.width).toBe('11px');
          expect(corner.style.height).toBe('13px');
        });
      });
    });

    it('should correctly set thumb height and width based on scrollable content', async () => {
      await render(
        <ScrollArea.Root style={{ width: VIEWPORT_SIZE, height: VIEWPORT_SIZE }}>
          <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
            <div style={{ width: SCROLLABLE_CONTENT_SIZE, height: SCROLLABLE_CONTENT_SIZE }} />
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar orientation="vertical" data-testid="vertical-scrollbar">
            <ScrollArea.Thumb data-testid="vertical-thumb" />
          </ScrollArea.Scrollbar>
          <ScrollArea.Scrollbar orientation="horizontal" data-testid="horizontal-scrollbar">
            <ScrollArea.Thumb data-testid="horizontal-thumb" />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>,
      );

      const verticalThumb = screen.getByTestId('vertical-thumb');
      const horizontalThumb = screen.getByTestId('horizontal-thumb');

      await waitFor(() => {
        expect(getComputedStyle(verticalThumb).getPropertyValue('--scroll-area-thumb-height')).toBe(
          `${(VIEWPORT_SIZE / SCROLLABLE_CONTENT_SIZE) * VIEWPORT_SIZE}px`,
        );
        expect(
          getComputedStyle(horizontalThumb).getPropertyValue('--scroll-area-thumb-width'),
        ).toBe(`${(VIEWPORT_SIZE / SCROLLABLE_CONTENT_SIZE) * VIEWPORT_SIZE}px`);
      });
    });

    it('should not add padding for overlay scrollbars', async () => {
      await render(
        <ScrollArea.Root style={{ width: VIEWPORT_SIZE, height: VIEWPORT_SIZE }}>
          <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
            <div style={{ width: SCROLLABLE_CONTENT_SIZE, height: SCROLLABLE_CONTENT_SIZE }} />
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar
            orientation="vertical"
            style={{ width: SCROLLBAR_WIDTH, height: '100%' }}
          />
          <ScrollArea.Scrollbar
            orientation="horizontal"
            style={{ height: SCROLLBAR_HEIGHT, width: '100%' }}
          />
        </ScrollArea.Root>,
      );

      const contentWrapper = screen.getByTestId('viewport').firstElementChild!;
      const style = getComputedStyle(contentWrapper);

      expect(style.paddingLeft).toBe('0px');
      expect(style.paddingRight).toBe('0px');
      expect(style.paddingBottom).toBe('0px');
    });

    it('accounts for scrollbar padding', async () => {
      const PADDING = 8;

      await render(
        <ScrollArea.Root style={{ width: VIEWPORT_SIZE, height: VIEWPORT_SIZE }}>
          <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
            <div style={{ width: SCROLLABLE_CONTENT_SIZE, height: SCROLLABLE_CONTENT_SIZE }} />
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar
            orientation="vertical"
            data-testid="vertical-scrollbar"
            style={{ paddingBlock: PADDING }}
          >
            <ScrollArea.Thumb data-testid="vertical-thumb" />
          </ScrollArea.Scrollbar>
          <ScrollArea.Scrollbar
            orientation="horizontal"
            data-testid="horizontal-scrollbar"
            style={{ paddingInline: PADDING }}
          >
            <ScrollArea.Thumb data-testid="horizontal-thumb" />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>,
      );

      const verticalThumb = screen.getByTestId('vertical-thumb');
      const horizontalThumb = screen.getByTestId('horizontal-thumb');

      await waitFor(() => {
        expect(getComputedStyle(verticalThumb).getPropertyValue('--scroll-area-thumb-height')).toBe(
          `${(VIEWPORT_SIZE - PADDING * 2) * (VIEWPORT_SIZE / SCROLLABLE_CONTENT_SIZE)}px`,
        );
        expect(
          getComputedStyle(horizontalThumb).getPropertyValue('--scroll-area-thumb-width'),
        ).toBe(`${(VIEWPORT_SIZE - PADDING * 2) * (VIEWPORT_SIZE / SCROLLABLE_CONTENT_SIZE)}px`);
      });
    });

    it('accounts for scrollbar margin', async () => {
      const margin = 11;
      const viewportSize = 390;

      await render(
        <ScrollArea.Root style={{ width: viewportSize, height: viewportSize }}>
          <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
            <div style={{ width: SCROLLABLE_CONTENT_SIZE, height: SCROLLABLE_CONTENT_SIZE }} />
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar
            orientation="vertical"
            data-testid="vertical-scrollbar"
            style={{ marginInline: margin }}
          >
            <ScrollArea.Thumb data-testid="vertical-thumb" />
          </ScrollArea.Scrollbar>
          <ScrollArea.Scrollbar
            orientation="horizontal"
            data-testid="horizontal-scrollbar"
            style={{ marginBlock: margin }}
          >
            <ScrollArea.Thumb data-testid="horizontal-thumb" />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>,
      );

      const verticalThumb = screen.getByTestId('vertical-thumb');
      const horizontalThumb = screen.getByTestId('horizontal-thumb');

      await waitFor(() => {
        expect(getComputedStyle(verticalThumb).getPropertyValue('--scroll-area-thumb-height')).toBe(
          `${viewportSize * (viewportSize / SCROLLABLE_CONTENT_SIZE)}px`,
        );
        expect(
          getComputedStyle(horizontalThumb).getPropertyValue('--scroll-area-thumb-width'),
        ).toBe(`${viewportSize * (viewportSize / SCROLLABLE_CONTENT_SIZE)}px`);
      });
    });

    it('accounts for thumb margin', async () => {
      const MARGIN = 8;

      await render(
        <ScrollArea.Root style={{ width: VIEWPORT_SIZE, height: VIEWPORT_SIZE }}>
          <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
            <div style={{ width: SCROLLABLE_CONTENT_SIZE, height: SCROLLABLE_CONTENT_SIZE }} />
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar orientation="vertical" data-testid="vertical-scrollbar">
            <ScrollArea.Thumb data-testid="vertical-thumb" style={{ marginBlock: MARGIN }} />
          </ScrollArea.Scrollbar>
          <ScrollArea.Scrollbar orientation="horizontal" data-testid="horizontal-scrollbar">
            <ScrollArea.Thumb data-testid="horizontal-thumb" style={{ marginInline: MARGIN }} />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>,
      );

      const verticalThumb = screen.getByTestId('vertical-thumb');
      const horizontalThumb = screen.getByTestId('horizontal-thumb');

      await waitFor(() => {
        expect(getComputedStyle(verticalThumb).getPropertyValue('--scroll-area-thumb-height')).toBe(
          `${(VIEWPORT_SIZE - MARGIN * 2) * (VIEWPORT_SIZE / SCROLLABLE_CONTENT_SIZE)}px`,
        );
        expect(
          getComputedStyle(horizontalThumb).getPropertyValue('--scroll-area-thumb-width'),
        ).toBe(`${(VIEWPORT_SIZE - MARGIN * 2) * (VIEWPORT_SIZE / SCROLLABLE_CONTENT_SIZE)}px`);
      });
    });
  });

  describe.skipIf(isJSDOM)('overflow data attributes', () => {
    it('recomputes horizontal overflow edges when direction changes', async () => {
      const renderArea = (direction: 'ltr' | 'rtl') => (
        <DirectionProvider direction={direction}>
          <ScrollArea.Root
            data-testid="root"
            style={{ width: VIEWPORT_SIZE, height: VIEWPORT_SIZE, direction }}
          >
            <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
              <div style={{ width: SCROLLABLE_CONTENT_SIZE, height: VIEWPORT_SIZE }} />
            </ScrollArea.Viewport>
            <ScrollArea.Scrollbar orientation="horizontal">
              <ScrollArea.Thumb />
            </ScrollArea.Scrollbar>
          </ScrollArea.Root>
        </DirectionProvider>
      );

      const { rerender } = await render(renderArea('ltr'));

      const root = screen.getByTestId('root');
      const viewport = screen.getByTestId('viewport');

      await waitFor(() => expect(root).toHaveAttribute('data-has-overflow-x'));

      const maxScrollLeft = viewport.scrollWidth - viewport.clientWidth;

      fireEvent.scroll(viewport, {
        target: {
          scrollLeft: maxScrollLeft / 2,
        },
      });

      /* eslint-disable testing-library/no-wait-for-multiple-assertions */
      await waitFor(() => {
        expect(root).toHaveAttribute('data-overflow-x-start');
        expect(root).toHaveAttribute('data-overflow-x-end');
      });
      /* eslint-enable testing-library/no-wait-for-multiple-assertions */

      await rerender(renderArea('rtl'));

      await act(async () => {
        viewport.scrollLeft = -maxScrollLeft;
      });

      await waitFor(() => {
        expect(root).toHaveAttribute('data-overflow-x-start');
        expect(root).not.toHaveAttribute('data-overflow-x-end');
      });
    });

    it('measures content mounted after the viewport initial measurement', async () => {
      function App() {
        const [show, setShow] = React.useState(false);
        return (
          <ScrollArea.Root
            data-testid="root"
            style={{ width: VIEWPORT_SIZE, height: VIEWPORT_SIZE }}
          >
            <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
              {show && (
                <ScrollArea.Content>
                  <div
                    style={{ width: SCROLLABLE_CONTENT_SIZE, height: SCROLLABLE_CONTENT_SIZE }}
                  />
                </ScrollArea.Content>
              )}
            </ScrollArea.Viewport>
            <ScrollArea.Scrollbar orientation="vertical">
              <ScrollArea.Thumb />
            </ScrollArea.Scrollbar>
            <button type="button" onClick={() => setShow(true)}>
              show
            </button>
          </ScrollArea.Root>
        );
      }

      await render(<App />);

      const root = screen.getByTestId('root');
      const viewport = screen.getByTestId('viewport');

      // Empty viewport: no overflow and kept out of tab order.
      await waitFor(() => {
        expect(root).not.toHaveAttribute('data-has-overflow-y');
      });
      expect(viewport).toHaveAttribute('tabindex', '-1');

      fireEvent.click(screen.getByText('show'));

      // Once oversized content mounts, overflow state and tab order must update.
      await waitFor(() => expect(root).toHaveAttribute('data-has-overflow-x'));
      await waitFor(() => expect(root).toHaveAttribute('data-has-overflow-y'));
      await waitFor(() => expect(viewport).toHaveAttribute('tabindex', '0'));
    });

    it('applies data attributes on root, viewport and scrollbars based on overflow and edges', async () => {
      await render(
        <ScrollArea.Root data-testid="root" style={{ width: VIEWPORT_SIZE, height: VIEWPORT_SIZE }}>
          <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
            <ScrollArea.Content data-testid="content">
              <div style={{ width: SCROLLABLE_CONTENT_SIZE, height: SCROLLABLE_CONTENT_SIZE }} />
            </ScrollArea.Content>
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar orientation="vertical" data-testid="scrollbar-vertical">
            <ScrollArea.Thumb />
          </ScrollArea.Scrollbar>
          <ScrollArea.Scrollbar orientation="horizontal" data-testid="scrollbar-horizontal">
            <ScrollArea.Thumb />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>,
      );

      const root = screen.getByTestId('root');
      const viewport = screen.getByTestId('viewport');
      const content = screen.getByTestId('content');
      const vScrollbar = screen.getByTestId('scrollbar-vertical');
      const hScrollbar = screen.getByTestId('scrollbar-horizontal');

      // Initial: at start (top/left)
      /* eslint-disable testing-library/no-wait-for-multiple-assertions */
      await waitFor(() => {
        expect(root).toHaveAttribute('data-has-overflow-x');
        expect(root).toHaveAttribute('data-has-overflow-y');
        expect(root).not.toHaveAttribute('data-overflow-x-start');
        expect(root).toHaveAttribute('data-overflow-x-end');
        expect(root).not.toHaveAttribute('data-overflow-y-start');
        expect(root).toHaveAttribute('data-overflow-y-end');

        expect(viewport).toHaveAttribute('data-has-overflow-x');
        expect(viewport).toHaveAttribute('data-has-overflow-y');
        expect(viewport).not.toHaveAttribute('data-overflow-x-start');
        expect(viewport).toHaveAttribute('data-overflow-x-end');
        expect(viewport).not.toHaveAttribute('data-overflow-y-start');
        expect(viewport).toHaveAttribute('data-overflow-y-end');
        expect(content).toHaveAttribute('data-has-overflow-x');
        expect(content).toHaveAttribute('data-has-overflow-y');
        expect(content).not.toHaveAttribute('data-overflow-x-start');
        expect(content).toHaveAttribute('data-overflow-x-end');
        expect(content).not.toHaveAttribute('data-overflow-y-start');
        expect(content).toHaveAttribute('data-overflow-y-end');

        expect(vScrollbar).toHaveAttribute('data-has-overflow-y');
        expect(vScrollbar).not.toHaveAttribute('data-overflow-y-start');
        expect(vScrollbar).toHaveAttribute('data-overflow-y-end');
        expect(hScrollbar).toHaveAttribute('data-has-overflow-x');
        expect(hScrollbar).not.toHaveAttribute('data-overflow-x-start');
        expect(hScrollbar).toHaveAttribute('data-overflow-x-end');
      });
      /* eslint-enable testing-library/no-wait-for-multiple-assertions */

      // Scroll to middle
      const halfY = (viewport.scrollHeight - viewport.clientHeight) / 2;
      const halfX = (viewport.scrollWidth - viewport.clientWidth) / 2;
      fireEvent.scroll(viewport, {
        target: { scrollTop: halfY, scrollLeft: halfX },
      });
      await flushMicrotasks();

      expect(root).toHaveAttribute('data-overflow-y-start');
      expect(root).toHaveAttribute('data-overflow-y-end');
      expect(root).toHaveAttribute('data-overflow-x-start');
      expect(root).toHaveAttribute('data-overflow-x-end');

      expect(viewport).toHaveAttribute('data-overflow-y-start');
      expect(viewport).toHaveAttribute('data-overflow-y-end');
      expect(viewport).toHaveAttribute('data-overflow-x-start');
      expect(viewport).toHaveAttribute('data-overflow-x-end');
      expect(content).toHaveAttribute('data-overflow-y-start');
      expect(content).toHaveAttribute('data-overflow-y-end');
      expect(content).toHaveAttribute('data-overflow-x-start');
      expect(content).toHaveAttribute('data-overflow-x-end');

      expect(vScrollbar).toHaveAttribute('data-overflow-y-start');
      expect(vScrollbar).toHaveAttribute('data-overflow-y-end');
      expect(hScrollbar).toHaveAttribute('data-overflow-x-start');
      expect(hScrollbar).toHaveAttribute('data-overflow-x-end');

      // Scroll to end
      fireEvent.scroll(viewport, {
        target: {
          scrollTop: viewport.scrollHeight - viewport.clientHeight,
          scrollLeft: viewport.scrollWidth - viewport.clientWidth,
        },
      });
      await flushMicrotasks();

      expect(root).toHaveAttribute('data-overflow-y-start');
      expect(root).not.toHaveAttribute('data-overflow-y-end');
      expect(root).toHaveAttribute('data-overflow-x-start');
      expect(root).not.toHaveAttribute('data-overflow-x-end');

      expect(viewport).toHaveAttribute('data-overflow-y-start');
      expect(viewport).not.toHaveAttribute('data-overflow-y-end');
      expect(viewport).toHaveAttribute('data-overflow-x-start');
      expect(viewport).not.toHaveAttribute('data-overflow-x-end');
      expect(content).toHaveAttribute('data-overflow-y-start');
      expect(content).not.toHaveAttribute('data-overflow-y-end');
      expect(content).toHaveAttribute('data-overflow-x-start');
      expect(content).not.toHaveAttribute('data-overflow-x-end');

      expect(vScrollbar).toHaveAttribute('data-overflow-y-start');
      expect(vScrollbar).not.toHaveAttribute('data-overflow-y-end');
      expect(hScrollbar).toHaveAttribute('data-overflow-x-start');
      expect(hScrollbar).not.toHaveAttribute('data-overflow-x-end');
    });

    it('treats near-edge scroll offsets as fully scrolled', async () => {
      await render(
        <ScrollArea.Root data-testid="root" style={{ width: VIEWPORT_SIZE, height: VIEWPORT_SIZE }}>
          <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
            <ScrollArea.Content data-testid="content">
              <div style={{ width: SCROLLABLE_CONTENT_SIZE, height: SCROLLABLE_CONTENT_SIZE }} />
            </ScrollArea.Content>
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar orientation="vertical" data-testid="scrollbar-vertical">
            <ScrollArea.Thumb />
          </ScrollArea.Scrollbar>
          <ScrollArea.Scrollbar orientation="horizontal" data-testid="scrollbar-horizontal">
            <ScrollArea.Thumb />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>,
      );

      const root = screen.getByTestId('root');
      const viewport = screen.getByTestId('viewport');

      const maxScrollTop = viewport.scrollHeight - viewport.clientHeight;
      const maxScrollLeft = viewport.scrollWidth - viewport.clientWidth;

      fireEvent.scroll(viewport, {
        target: {
          scrollTop: maxScrollTop - 0.5,
          scrollLeft: maxScrollLeft - 0.5,
        },
      });
      await flushMicrotasks();

      expect(root).toHaveAttribute('data-overflow-y-start');
      expect(root).not.toHaveAttribute('data-overflow-y-end');
      expect(root).toHaveAttribute('data-overflow-x-start');
      expect(root).not.toHaveAttribute('data-overflow-x-end');
    });

    it('respects overflowEdgeThreshold and exposes scroll metrics', async () => {
      await render(
        <ScrollArea.Root
          data-testid="root"
          overflowEdgeThreshold={{ xStart: 20, yStart: 5 }}
          style={{ width: VIEWPORT_SIZE, height: VIEWPORT_SIZE }}
        >
          <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
            <ScrollArea.Content data-testid="content">
              <div style={{ width: SCROLLABLE_CONTENT_SIZE, height: SCROLLABLE_CONTENT_SIZE }} />
            </ScrollArea.Content>
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar orientation="vertical" data-testid="scrollbar-vertical">
            <ScrollArea.Thumb />
          </ScrollArea.Scrollbar>
          <ScrollArea.Scrollbar orientation="horizontal" data-testid="scrollbar-horizontal">
            <ScrollArea.Thumb />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>,
      );

      const viewport = screen.getByTestId('viewport');

      fireEvent.scroll(viewport, {
        target: { scrollLeft: 15, scrollTop: 7 },
      });

      await waitFor(() => expect(viewport).not.toHaveAttribute('data-overflow-x-start'));
      expect(viewport).toHaveAttribute('data-overflow-y-start');

      fireEvent.scroll(viewport, {
        target: { scrollLeft: 35, scrollTop: 7 },
      });

      await waitFor(() => expect(viewport).toHaveAttribute('data-overflow-x-start'));

      const viewportStyle = viewport.style;
      const startPx = viewportStyle.getPropertyValue('--scroll-area-overflow-x-start');
      expect(startPx).toBe('35px');

      const horizontalEndPx = viewportStyle.getPropertyValue('--scroll-area-overflow-x-end');
      expect(horizontalEndPx).not.toBe('');
      expect(horizontalEndPx).not.toBe('0px');
    });

    it('applies numeric overflowEdgeThreshold to every edge', async () => {
      await render(
        <ScrollArea.Root
          data-testid="root"
          overflowEdgeThreshold={20}
          style={{ width: VIEWPORT_SIZE, height: VIEWPORT_SIZE }}
        >
          <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
            <ScrollArea.Content>
              <div style={{ width: SCROLLABLE_CONTENT_SIZE, height: SCROLLABLE_CONTENT_SIZE }} />
            </ScrollArea.Content>
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar orientation="vertical">
            <ScrollArea.Thumb />
          </ScrollArea.Scrollbar>
          <ScrollArea.Scrollbar orientation="horizontal">
            <ScrollArea.Thumb />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>,
      );

      const viewport = screen.getByTestId('viewport');

      await waitFor(() => expect(viewport).toHaveAttribute('data-has-overflow-x'));

      fireEvent.scroll(viewport, {
        target: { scrollLeft: 15, scrollTop: 15 },
      });

      expect(viewport).not.toHaveAttribute('data-overflow-x-start');
      expect(viewport).not.toHaveAttribute('data-overflow-y-start');
      expect(viewport).toHaveAttribute('data-overflow-x-end');
      expect(viewport).toHaveAttribute('data-overflow-y-end');

      fireEvent.scroll(viewport, {
        target: {
          scrollLeft: viewport.scrollWidth - viewport.clientWidth - 15,
          scrollTop: viewport.scrollHeight - viewport.clientHeight - 15,
        },
      });

      expect(viewport).toHaveAttribute('data-overflow-x-start');
      expect(viewport).toHaveAttribute('data-overflow-y-start');
      expect(viewport).not.toHaveAttribute('data-overflow-x-end');
      expect(viewport).not.toHaveAttribute('data-overflow-y-end');
    });

    it('recomputes overflow edges when overflowEdgeThreshold changes', async () => {
      const renderArea = (yStart: number) => (
        <ScrollArea.Root
          data-testid="root"
          overflowEdgeThreshold={{ yStart }}
          style={{ width: VIEWPORT_SIZE, height: VIEWPORT_SIZE }}
        >
          <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
            <ScrollArea.Content>
              <div style={{ width: SCROLLABLE_CONTENT_SIZE, height: SCROLLABLE_CONTENT_SIZE }} />
            </ScrollArea.Content>
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar orientation="vertical">
            <ScrollArea.Thumb />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>
      );

      const { rerender } = await render(renderArea(5));

      const viewport = screen.getByTestId('viewport');

      fireEvent.scroll(viewport, { target: { scrollTop: 10 } });
      await waitFor(() => expect(viewport).toHaveAttribute('data-overflow-y-start'));

      // Raising the threshold above the current offset must clear the edge without a new scroll.
      await rerender(renderArea(20));
      await waitFor(() => expect(viewport).not.toHaveAttribute('data-overflow-y-start'));
    });

    it('does not add state attributes when content does not overflow', async () => {
      await render(
        <ScrollArea.Root data-testid="root" style={{ width: VIEWPORT_SIZE, height: VIEWPORT_SIZE }}>
          <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
            <ScrollArea.Content data-testid="content">
              <div style={{ width: VIEWPORT_SIZE / 2, height: VIEWPORT_SIZE / 2 }} />
            </ScrollArea.Content>
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar orientation="vertical" keepMounted data-testid="scrollbar-vertical">
            <ScrollArea.Thumb />
          </ScrollArea.Scrollbar>
          <ScrollArea.Scrollbar
            orientation="horizontal"
            keepMounted
            data-testid="scrollbar-horizontal"
          >
            <ScrollArea.Thumb />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>,
      );

      const root = screen.getByTestId('root');
      const viewport = screen.getByTestId('viewport');
      const content = screen.getByTestId('content');
      const vScrollbar = screen.getByTestId('scrollbar-vertical');
      const hScrollbar = screen.getByTestId('scrollbar-horizontal');

      expect(root).not.toHaveAttribute('data-has-overflow-x');
      expect(root).not.toHaveAttribute('data-has-overflow-y');
      expect(root).not.toHaveAttribute('data-overflow-x-start');
      expect(root).not.toHaveAttribute('data-overflow-x-end');
      expect(root).not.toHaveAttribute('data-overflow-y-start');
      expect(root).not.toHaveAttribute('data-overflow-y-end');

      expect(viewport).not.toHaveAttribute('data-overflow-x-start');
      expect(viewport).not.toHaveAttribute('data-overflow-x-end');
      expect(viewport).not.toHaveAttribute('data-overflow-y-start');
      expect(viewport).not.toHaveAttribute('data-overflow-y-end');
      expect(content).not.toHaveAttribute('data-overflow-x-start');
      expect(content).not.toHaveAttribute('data-overflow-x-end');
      expect(content).not.toHaveAttribute('data-overflow-y-start');
      expect(content).not.toHaveAttribute('data-overflow-y-end');

      expect(vScrollbar).not.toHaveAttribute('data-overflow-y-start');
      expect(vScrollbar).not.toHaveAttribute('data-overflow-y-end');
      expect(hScrollbar).not.toHaveAttribute('data-overflow-x-start');
      expect(hScrollbar).not.toHaveAttribute('data-overflow-x-end');
    });

    it('correctly handles RTL', async () => {
      await render(
        <DirectionProvider direction="rtl">
          <ScrollArea.Root
            data-testid="root"
            style={{ width: VIEWPORT_SIZE, height: VIEWPORT_SIZE, direction: 'rtl' }}
          >
            <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
              <div style={{ width: SCROLLABLE_CONTENT_SIZE, height: 200 }} />
            </ScrollArea.Viewport>
            <ScrollArea.Scrollbar orientation="horizontal" data-testid="scrollbar-horizontal">
              <ScrollArea.Thumb />
            </ScrollArea.Scrollbar>
          </ScrollArea.Root>
        </DirectionProvider>,
      );

      const root = screen.getByTestId('root');
      const viewport = screen.getByTestId('viewport');

      const maxScrollLeft = viewport.scrollWidth - viewport.clientWidth;
      fireEvent.scroll(viewport, {
        target: {
          scrollLeft: 0,
        },
      });

      await waitFor(() => expect(root).toHaveAttribute('data-has-overflow-x'));
      expect(root).not.toHaveAttribute('data-overflow-x-start');
      expect(root).toHaveAttribute('data-overflow-x-end');

      fireEvent.scroll(viewport, {
        target: {
          scrollLeft: -maxScrollLeft / 2,
        },
      });

      await waitFor(() => expect(root).toHaveAttribute('data-overflow-x-start'));
      expect(root).toHaveAttribute('data-overflow-x-end');

      fireEvent.scroll(viewport, {
        target: {
          scrollLeft: -maxScrollLeft,
        },
      });

      await waitFor(() => expect(root).toHaveAttribute('data-overflow-x-start'));
      expect(root).not.toHaveAttribute('data-overflow-x-end');
    });
  });
});
