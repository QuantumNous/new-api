import { vi, expect } from 'vitest';
import {
  fireEvent,
  ignoreActWarnings,
  reactMajor,
  screen,
  waitFor,
} from '@mui/internal-test-utils';
import { ContextMenu } from '@base-ui/react/context-menu';
import { createRenderer } from '#test-utils';

vi.mock('@base-ui/utils/platform', async () => {
  const actual =
    await vi.importActual<typeof import('@base-ui/utils/platform')>('@base-ui/utils/platform');

  return {
    ...actual,
    platform: {
      ...actual.platform,
      os: { ...actual.platform.os, mac: false, apple: false },
    },
  };
});

describe('<ContextMenu.Root /> (non-Mac)', () => {
  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  const { render, clock } = createRenderer({
    clockOptions: {
      shouldAdvanceTime: true,
    },
  });

  describe('interactions', () => {
    clock.withFakeTimers();

    it('ignores context menu mouseup on non-Mac platforms', async () => {
      if (reactMajor <= 18) {
        ignoreActWarnings();
      }

      const onOpenChange = vi.fn();

      await render(
        <ContextMenu.Root onOpenChange={onOpenChange}>
          <ContextMenu.Trigger data-testid="context-trigger">Surface</ContextMenu.Trigger>
          <ContextMenu.Portal>
            <ContextMenu.Positioner alignOffset={0}>
              <ContextMenu.Popup data-testid="context-popup">
                <ContextMenu.Item data-testid="context-item">Action</ContextMenu.Item>
              </ContextMenu.Popup>
            </ContextMenu.Positioner>
          </ContextMenu.Portal>
        </ContextMenu.Root>,
      );

      const trigger = screen.getByTestId('context-trigger');

      fireEvent.contextMenu(trigger, { clientX: 12, clientY: 12, button: 2 });

      await screen.findByTestId('context-popup');
      const item = screen.getByTestId('context-item');

      fireEvent.pointerMove(document.body, { clientX: 24, clientY: 24 });
      fireEvent.mouseUp(item, { button: 2, clientX: 24, clientY: 24 });

      await waitFor(() => {
        expect(screen.queryByTestId('context-popup')).not.toBe(null);
      });

      expect(onOpenChange.mock.calls.length).toBe(1);
    });
  });
});
