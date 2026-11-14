import * as React from 'react';
import { expect, vi } from 'vitest';
import { NavigationMenu } from '@base-ui/react/navigation-menu';
import { DirectionProvider } from '@base-ui/react/direction-provider';
import { createRenderer, describeConformance, isJSDOM } from '#test-utils';
import { screen, flushMicrotasks, waitFor, act } from '@mui/internal-test-utils';
import userEvent from '@testing-library/user-event';

const rapidHoverAnimationStyles = `
  .test-navigation-menu-popup {
    transition:
      width 350ms cubic-bezier(0.22, 1, 0.36, 1),
      height 350ms cubic-bezier(0.22, 1, 0.36, 1);
    width: var(--popup-width);
    height: var(--popup-height);
  }
`;

function TestNavigationMenuRapidHoverSizing() {
  const [isProductExpanded, setIsProductExpanded] = React.useState(false);

  return (
    <NavigationMenu.Root>
      {/* eslint-disable-next-line react/no-danger */}
      <style dangerouslySetInnerHTML={{ __html: rapidHoverAnimationStyles }} />
      <NavigationMenu.List style={{ display: 'flex' }}>
        <NavigationMenu.Item value="product">
          <NavigationMenu.Trigger>Product</NavigationMenu.Trigger>
          <NavigationMenu.Content>
            <div>
              <button type="button" onClick={() => setIsProductExpanded(true)}>
                Expand Product
              </button>
              {isProductExpanded ? (
                <div style={{ width: 760, height: 460 }}>Expanded product panel</div>
              ) : (
                <div style={{ width: 700, height: 420 }}>Product panel</div>
              )}
            </div>
          </NavigationMenu.Content>
        </NavigationMenu.Item>

        <NavigationMenu.Item value="solutions">
          <NavigationMenu.Trigger>Solutions</NavigationMenu.Trigger>
          <NavigationMenu.Content>
            <div style={{ width: 500, height: 320 }}>Solutions panel</div>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
      </NavigationMenu.List>
      <NavigationMenu.Portal>
        <NavigationMenu.Positioner>
          <NavigationMenu.Popup data-testid="popup-root" className="test-navigation-menu-popup">
            <NavigationMenu.Viewport />
          </NavigationMenu.Popup>
        </NavigationMenu.Positioner>
      </NavigationMenu.Portal>
    </NavigationMenu.Root>
  );
}

function getPopupWidthCalls(calls: Array<[property: string, value: string, priority?: string]>) {
  return calls.filter((call) => call[0] === '--popup-width').map((call) => call[1]);
}

function getPositionerWidthCalls(
  calls: Array<[property: string, value: string, priority?: string]>,
) {
  return calls.filter((call) => call[0] === '--positioner-width').map((call) => call[1]);
}

describe('<NavigationMenu.Trigger />', () => {
  const { render } = createRenderer();

  describeConformance(<NavigationMenu.Trigger />, () => ({
    refInstanceof: window.HTMLButtonElement,
    testComponentPropWith: 'button',
    button: true,
    render(node) {
      return render(
        <NavigationMenu.Root>
          <NavigationMenu.List>
            <NavigationMenu.Item>{node}</NavigationMenu.Item>
          </NavigationMenu.List>
        </NavigationMenu.Root>,
      );
    },
  }));

  it('opens a vertical menu with the mirrored arrow key in RTL mode', async () => {
    await render(
      <DirectionProvider direction="rtl">
        <NavigationMenu.Root orientation="vertical">
          <NavigationMenu.List>
            <NavigationMenu.Item>
              <NavigationMenu.Trigger>Overview</NavigationMenu.Trigger>
              <NavigationMenu.Content>
                <NavigationMenu.Link href="#">Quick Start</NavigationMenu.Link>
              </NavigationMenu.Content>
            </NavigationMenu.Item>
          </NavigationMenu.List>
          <NavigationMenu.Portal>
            <NavigationMenu.Positioner>
              <NavigationMenu.Popup>
                <NavigationMenu.Viewport />
              </NavigationMenu.Popup>
            </NavigationMenu.Positioner>
          </NavigationMenu.Portal>
        </NavigationMenu.Root>
      </DirectionProvider>,
    );

    const trigger = screen.getByRole('button', { name: 'Overview' });
    trigger.focus();

    await userEvent.keyboard('{ArrowLeft}');

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Quick Start' })).toBeVisible();
    });
  });

  it.skipIf(isJSDOM)('handles focus and positioner height', async () => {
    await render(
      <NavigationMenu.Root>
        <NavigationMenu.List>
          <NavigationMenu.Item>
            <NavigationMenu.Trigger>Overview</NavigationMenu.Trigger>
            <NavigationMenu.Content>
              <NavigationMenu.Link href="#">Quick Start</NavigationMenu.Link>
            </NavigationMenu.Content>
          </NavigationMenu.Item>
          <NavigationMenu.Item>
            <NavigationMenu.Trigger>Handbook</NavigationMenu.Trigger>
            <NavigationMenu.Content>
              <NavigationMenu.Link href="#">Styling Base UI components</NavigationMenu.Link>
            </NavigationMenu.Content>
            <NavigationMenu.Content>
              <NavigationMenu.Link href="#">Second Link</NavigationMenu.Link>
            </NavigationMenu.Content>
          </NavigationMenu.Item>
        </NavigationMenu.List>
        <NavigationMenu.Portal>
          <NavigationMenu.Positioner data-testid="positioner">
            <NavigationMenu.Popup>
              <NavigationMenu.Viewport />
            </NavigationMenu.Popup>
          </NavigationMenu.Positioner>
        </NavigationMenu.Portal>
      </NavigationMenu.Root>,
    );

    const overviewButton = screen.getByRole('button', { name: 'Overview' });
    await act(async () => {
      overviewButton.focus();
    });

    await userEvent.keyboard('{ArrowDown}');
    await flushMicrotasks();

    const positioner = screen.getByTestId('positioner');
    await waitFor(() => {
      expect(
        Math.abs(
          parseInt(getComputedStyle(positioner).getPropertyValue('--positioner-height'), 10) - 18,
        ),
      ).toBeLessThanOrEqual(1);
    });

    const overviewLink = screen.getByRole('link', { name: 'Quick Start' });
    await waitFor(() => {
      expect(overviewLink).toHaveFocus();
    });

    await userEvent.tab({ shift: true });

    await waitFor(() => {
      expect(overviewButton).toHaveFocus();
    });

    await userEvent.keyboard('{ArrowRight}');
    const handbookButton = screen.getByRole('button', { name: 'Handbook' });
    await waitFor(() => {
      expect(handbookButton).toHaveFocus();
    });

    await userEvent.keyboard('{ArrowDown}');
    await flushMicrotasks();

    await waitFor(() => {
      expect(
        Math.abs(
          parseInt(getComputedStyle(positioner).getPropertyValue('--positioner-height'), 10) - 36,
        ),
      ).toBeLessThanOrEqual(1);
    });

    const handbookLink = screen.getByRole('link', { name: 'Styling Base UI components' });
    await waitFor(() => {
      expect(handbookLink).toHaveFocus();
    });

    await userEvent.tab({ shift: true });
    await waitFor(() => {
      expect(handbookButton).toHaveFocus();
    });

    await userEvent.keyboard('{ArrowLeft}');
    await waitFor(() => {
      expect(overviewButton).toHaveFocus();
    });

    await userEvent.keyboard('{ArrowDown}');
    await flushMicrotasks();
    await waitFor(() => {
      expect(
        Math.abs(
          parseInt(getComputedStyle(positioner).getPropertyValue('--positioner-height'), 10) - 18,
        ),
      ).toBeLessThanOrEqual(1);
    });
  });

  it.skipIf(isJSDOM)('handles positioner width correctly', async () => {
    await render(
      <NavigationMenu.Root>
        <NavigationMenu.List>
          <NavigationMenu.Item>
            <NavigationMenu.Trigger>noContent</NavigationMenu.Trigger>
          </NavigationMenu.Item>
          <NavigationMenu.Item>
            <NavigationMenu.Trigger>withContent</NavigationMenu.Trigger>
            <NavigationMenu.Content>
              <NavigationMenu.Link href="#">Styling Base UI components</NavigationMenu.Link>
            </NavigationMenu.Content>
          </NavigationMenu.Item>
        </NavigationMenu.List>
        <NavigationMenu.Portal>
          <NavigationMenu.Positioner data-testid="positioner">
            <NavigationMenu.Popup>
              <NavigationMenu.Viewport />
            </NavigationMenu.Popup>
          </NavigationMenu.Positioner>
        </NavigationMenu.Portal>
      </NavigationMenu.Root>,
    );

    const noContentButton = screen.getByRole('button', { name: 'noContent' });
    const withContentButton = screen.getByRole('button', { name: 'withContent' });

    await userEvent.pointer([
      { target: withContentButton },
      { target: noContentButton, releasePrevious: true },
      { target: withContentButton, releasePrevious: true },
    ]);

    await waitFor(() => {
      const handbookLink = screen.getByRole('link', { name: 'Styling Base UI components' });

      expect(handbookLink).toBeVisible();
    });

    const positioner = await screen.findByTestId('positioner');

    await waitFor(() => {
      expect(
        Math.abs(
          parseInt(getComputedStyle(positioner).getPropertyValue('--positioner-width'), 10) - 183,
        ),
      ).toBeLessThanOrEqual(1);
    });
  });

  it.skipIf(isJSDOM)('repositions the positioner when switching triggers via hover', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });

    await render(
      <NavigationMenu.Root>
        <NavigationMenu.List style={{ display: 'flex' }}>
          <NavigationMenu.Item>
            <NavigationMenu.Trigger>Overview</NavigationMenu.Trigger>
            <NavigationMenu.Content>
              <NavigationMenu.Link href="#">Overview Link</NavigationMenu.Link>
            </NavigationMenu.Content>
          </NavigationMenu.Item>
          <NavigationMenu.Item>
            <NavigationMenu.Trigger>Handbook</NavigationMenu.Trigger>
            <NavigationMenu.Content>
              <NavigationMenu.Link href="#">Handbook Link</NavigationMenu.Link>
            </NavigationMenu.Content>
          </NavigationMenu.Item>
        </NavigationMenu.List>
        <NavigationMenu.Portal>
          <NavigationMenu.Positioner data-testid="positioner">
            <NavigationMenu.Popup>
              <NavigationMenu.Viewport />
            </NavigationMenu.Popup>
          </NavigationMenu.Positioner>
        </NavigationMenu.Portal>
      </NavigationMenu.Root>,
    );

    const overviewButton = screen.getByRole('button', { name: 'Overview' });
    const handbookButton = screen.getByRole('button', { name: 'Handbook' });

    await user.pointer([{ target: overviewButton }]);
    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Overview Link' })).toBeVisible();
    });

    const positioner = screen.getByTestId('positioner');
    const firstLeft = positioner.getBoundingClientRect().left;

    await user.pointer([{ target: handbookButton, releasePrevious: true }]);
    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Handbook Link' })).toBeVisible();
    });

    await waitFor(() => {
      const secondLeft = positioner.getBoundingClientRect().left;
      expect(Math.abs(secondLeft - firstLeft)).toBeGreaterThan(20);
    });
  });

  it.skipIf(isJSDOM)(
    'does not let a previously hovered trigger reapply popup sizes after a later switch',
    async () => {
      const user = userEvent.setup({ pointerEventsCheck: 0 });

      await render(<TestNavigationMenuRapidHoverSizing />);

      await user.hover(screen.getByRole('button', { name: 'Product' }));

      const popupRoot = await screen.findByTestId('popup-root');
      const setPropertySpy = vi.spyOn(popupRoot.style, 'setProperty');
      const getWidthCallsSince = (startIndex = 0) =>
        getPopupWidthCalls(
          setPropertySpy.mock.calls.slice(startIndex) as Array<
            [property: string, value: string, priority?: string]
          >,
        );

      await waitFor(() => {
        expect(popupRoot.style.getPropertyValue('--popup-width')).toBe('700px');
      });

      const callsBeforeSolutionsHover = setPropertySpy.mock.calls.length;

      await user.hover(screen.getByRole('button', { name: 'Solutions' }));

      await waitFor(() => {
        expect(screen.getByText('Solutions panel')).toBeVisible();
      });

      await waitFor(() => {
        const popupWidthCallsAfterSwitch = getWidthCallsSince(callsBeforeSolutionsHover);
        const solutionsWidthIndex = popupWidthCallsAfterSwitch.indexOf('500px');

        expect(solutionsWidthIndex).toBeGreaterThan(-1);
        expect(popupWidthCallsAfterSwitch.slice(solutionsWidthIndex + 1)).not.toContain('700px');
      });

      await waitFor(() => {
        expect(popupRoot.style.getPropertyValue('--popup-width')).toBe('auto');
      });

      setPropertySpy.mockRestore();
    },
  );

  it.skipIf(isJSDOM)(
    'does not let interrupted mutation resizing reapply popup sizes after a later switch',
    async () => {
      const user = userEvent.setup({ pointerEventsCheck: 0 });

      await render(<TestNavigationMenuRapidHoverSizing />);

      await user.hover(screen.getByRole('button', { name: 'Product' }));

      const popupRoot = await screen.findByTestId('popup-root');
      const positioner = popupRoot.parentElement as HTMLElement;
      const setPositionerPropertySpy = vi.spyOn(positioner.style, 'setProperty');
      const getPositionerWidthCallsSince = (startIndex = 0) =>
        getPositionerWidthCalls(
          setPositionerPropertySpy.mock.calls.slice(startIndex) as Array<
            [property: string, value: string, priority?: string]
          >,
        );

      await waitFor(() => {
        expect(popupRoot.style.getPropertyValue('--popup-width')).toBe('700px');
      });

      let popupWidth = 700;
      let popupHeight = 420;

      Object.defineProperty(popupRoot, 'offsetWidth', {
        configurable: true,
        get: () => popupWidth,
      });
      Object.defineProperty(popupRoot, 'offsetHeight', {
        configurable: true,
        get: () => popupHeight,
      });

      popupRoot.style.setProperty('--popup-width', '700px');
      popupRoot.style.setProperty('--popup-height', '420px');

      popupWidth = 760;
      popupHeight = 460;
      await user.click(screen.getByRole('button', { name: 'Expand Product' }));

      await waitFor(() => {
        expect(
          setPositionerPropertySpy.mock.calls.some(
            (call) => call[0] === '--positioner-width' && call[1] === '760px',
          ),
        ).toBe(true);
      });

      popupWidth = 500;
      popupHeight = 320;
      const callsBeforeSolutionsHover = setPositionerPropertySpy.mock.calls.length;

      await user.hover(screen.getByRole('button', { name: 'Solutions' }));

      await waitFor(() => {
        expect(screen.getByText('Solutions panel')).toBeVisible();
      });

      await waitFor(() => {
        const positionerWidthCallsAfterSwitch =
          getPositionerWidthCallsSince(callsBeforeSolutionsHover);
        const solutionsWidthIndex = positionerWidthCallsAfterSwitch.indexOf('500px');

        expect(solutionsWidthIndex).toBeGreaterThan(-1);
        expect(positionerWidthCallsAfterSwitch.slice(solutionsWidthIndex + 1)).not.toContain(
          '760px',
        );
      });

      await waitFor(() => {
        expect(positioner.style.getPropertyValue('--positioner-width')).toBe('500px');
      });

      setPositionerPropertySpy.mockRestore();
    },
  );
});
