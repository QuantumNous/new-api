import { expect } from 'vitest';
import { ScrollArea } from '@base-ui/react/scroll-area';
import { screen, waitFor } from '@mui/internal-test-utils';
import { createRenderer, isJSDOM } from '#test-utils';
import { describeConformance } from '../../../test/describeConformance';

function mockViewportMetrics(viewport: HTMLDivElement | null) {
  if (!viewport) {
    return;
  }

  const metrics = {
    clientHeight: 100,
    scrollHeight: 1000,
    clientWidth: 100,
    scrollWidth: 1000,
  };

  for (const [key, value] of Object.entries(metrics)) {
    const descriptor = Object.getOwnPropertyDescriptor(viewport, key);
    if (!descriptor || descriptor.configurable) {
      Object.defineProperty(viewport, key, { value, configurable: true });
    }
  }
}

describe('<ScrollArea.Corner />', () => {
  const { render } = createRenderer();

  describeConformance(<ScrollArea.Corner />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(
        <ScrollArea.Root>
          <ScrollArea.Viewport ref={mockViewportMetrics} style={{ width: 100, height: 100 }}>
            <div style={{ width: 1000, height: 1000 }} />
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar orientation="vertical" keepMounted style={{ width: 10 }}>
            <ScrollArea.Thumb />
          </ScrollArea.Scrollbar>
          <ScrollArea.Scrollbar orientation="horizontal" keepMounted style={{ height: 10 }}>
            <ScrollArea.Thumb />
          </ScrollArea.Scrollbar>
          {node}
        </ScrollArea.Root>,
      );
    },
  }));

  describe.skipIf(isJSDOM)('interactions', () => {
    it('should apply correct corner size when both scrollbars are present', async () => {
      await render(
        <ScrollArea.Root style={{ width: 200, height: 200 }}>
          <ScrollArea.Viewport data-testid="viewport" style={{ width: '100%', height: '100%' }}>
            <div style={{ width: 1000, height: 1000 }} />
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar orientation="vertical" style={{ width: 10 }} />
          <ScrollArea.Scrollbar orientation="horizontal" style={{ height: 10 }} />
          <ScrollArea.Corner data-testid="corner" />
        </ScrollArea.Root>,
      );

      const corner = screen.getByTestId('corner');

      await waitFor(() => {
        const style = getComputedStyle(corner);
        expect(style.getPropertyValue('--scroll-area-corner-width')).toBe('10px');
        expect(style.getPropertyValue('--scroll-area-corner-height')).toBe('10px');
      });
    });
  });
});
