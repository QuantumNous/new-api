import { expect, vi } from 'vitest';
import * as React from 'react';
import { fireEvent, screen, flushMicrotasks, act, within, waitFor } from '@mui/internal-test-utils';
import { NavigationMenu } from '@base-ui/react/navigation-menu';
import { Dialog } from '@base-ui/react/dialog';
import { DirectionProvider, type TextDirection } from '@base-ui/react/direction-provider';
import { Popover } from '@base-ui/react/popover';
import { createRenderer, describeConformance, isJSDOM } from '#test-utils';
import { PATIENT_CLICK_THRESHOLD } from '../../internals/constants';
import { OPEN_DELAY } from '../utils/constants';

type FalsyNavigationMenuValue = 0 | '' | false;

const falsyNavigationMenuValueCases = [
  ['0', 0],
  ['empty string', ''],
  ['false', false],
] as const satisfies ReadonlyArray<[string, FalsyNavigationMenuValue]>;

function TestNavigationMenu(
  props: NavigationMenu.Root.Props & {
    keepMountedPortal?: boolean;
  },
) {
  const { keepMountedPortal = false, ...rootProps } = props;

  return (
    <NavigationMenu.Root {...rootProps}>
      <NavigationMenu.List>
        <NavigationMenu.Item value="item-1">
          <NavigationMenu.Trigger data-testid="trigger-1">Item 1</NavigationMenu.Trigger>
          <NavigationMenu.Content data-testid="popup-1">
            <NavigationMenu.Link href="#link-1">Link 1</NavigationMenu.Link>
            <NavigationMenu.Link href="#link-2">Link 2</NavigationMenu.Link>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
        <NavigationMenu.Item value="item-2">
          <NavigationMenu.Trigger data-testid="trigger-2">Item 2</NavigationMenu.Trigger>
          <NavigationMenu.Content data-testid="popup-2">
            <NavigationMenu.Link href="#link-3">Link 3</NavigationMenu.Link>
            <NavigationMenu.Link href="#link-4">Link 4</NavigationMenu.Link>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
      </NavigationMenu.List>

      <NavigationMenu.Portal keepMounted={keepMountedPortal}>
        <NavigationMenu.Positioner data-testid="top-level-positioner">
          <NavigationMenu.Popup data-testid="popup-root">
            <NavigationMenu.Viewport />
          </NavigationMenu.Popup>
        </NavigationMenu.Positioner>
      </NavigationMenu.Portal>
    </NavigationMenu.Root>
  );
}

function TestNavigationMenuWithTopLevelLink(props: NavigationMenu.Root.Props = {}) {
  return (
    <NavigationMenu.Root {...props}>
      <NavigationMenu.List>
        <NavigationMenu.Item value="item-1">
          <NavigationMenu.Trigger data-testid="trigger-1">Item 1</NavigationMenu.Trigger>
          <NavigationMenu.Content data-testid="popup-1">
            <NavigationMenu.Link href="#link-1">Link 1</NavigationMenu.Link>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
        <NavigationMenu.Item value="item-2">
          <NavigationMenu.Trigger data-testid="trigger-2">Item 2</NavigationMenu.Trigger>
          <NavigationMenu.Content data-testid="popup-2">
            <NavigationMenu.Link href="#link-2">Link 2</NavigationMenu.Link>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
        <NavigationMenu.Item>
          <NavigationMenu.Link href="#top-level-link" data-testid="top-level-link">
            Top level link
          </NavigationMenu.Link>
        </NavigationMenu.Item>
      </NavigationMenu.List>

      <NavigationMenu.Portal>
        <NavigationMenu.Positioner data-testid="top-level-positioner">
          <NavigationMenu.Popup>
            <NavigationMenu.Viewport />
          </NavigationMenu.Popup>
        </NavigationMenu.Positioner>
      </NavigationMenu.Portal>
    </NavigationMenu.Root>
  );
}

function TestNavigationMenuWithDisabledTrigger(props: NavigationMenu.Root.Props = {}) {
  return (
    <NavigationMenu.Root {...props}>
      <NavigationMenu.List>
        <NavigationMenu.Item value="item-1">
          <NavigationMenu.Trigger data-testid="trigger-1" disabled>
            Item 1
          </NavigationMenu.Trigger>
          <NavigationMenu.Content data-testid="popup-1">
            <NavigationMenu.Link href="#link-1">Link 1</NavigationMenu.Link>
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
  );
}

const scopedPopupAnimationStyles = `
  .test-navigation-menu-popup {
    transition-property: opacity, transform, width, height;
    transition-duration: 350ms;
    transition-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
  }

  .test-navigation-menu-popup[data-starting-style],
  .test-navigation-menu-popup[data-ending-style] {
    opacity: 0;
    transform: scale(0.9);
  }

  .test-navigation-menu-popup[data-ending-style] {
    transition-property: opacity, transform;
    transition-duration: 150ms;
    transition-timing-function: ease;
  }

  .test-navigation-menu-content {
    transition:
      opacity 175ms ease,
      transform 350ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  .test-navigation-menu-content[data-starting-style],
  .test-navigation-menu-content[data-ending-style] {
    opacity: 0;
  }

  .test-navigation-menu-content[data-starting-style][data-activation-direction='left'] {
    transform: translateX(-2rem);
  }

  .test-navigation-menu-content[data-starting-style][data-activation-direction='right'] {
    transform: translateX(2rem);
  }

  .test-navigation-menu-content[data-ending-style] {
    transition-duration: 175ms;
    transition-timing-function: ease;
  }

  .test-navigation-menu-content[data-ending-style][data-activation-direction='left'] {
    transform: translateX(2rem);
  }

  .test-navigation-menu-content[data-ending-style][data-activation-direction='right'] {
    transform: translateX(-2rem);
  }
`;

function TestNavigationMenuWithTopLevelLinkScopedPopupAnimation() {
  return (
    <NavigationMenu.Root>
      {/* eslint-disable-next-line react/no-danger */}
      <style dangerouslySetInnerHTML={{ __html: scopedPopupAnimationStyles }} />
      <NavigationMenu.List>
        <NavigationMenu.Item value="item-1">
          <NavigationMenu.Trigger data-testid="trigger-product">Product</NavigationMenu.Trigger>
          <NavigationMenu.Content className="test-navigation-menu-content">
            <div style={{ width: 675, height: 220 }}>Product panel</div>
          </NavigationMenu.Content>
        </NavigationMenu.Item>

        <NavigationMenu.Item>
          <NavigationMenu.Link href="#top-level-link" data-testid="top-level-link">
            Top level link
          </NavigationMenu.Link>
        </NavigationMenu.Item>

        <NavigationMenu.Item value="item-2">
          <NavigationMenu.Trigger data-testid="trigger-learn">Learn</NavigationMenu.Trigger>
          <NavigationMenu.Content className="test-navigation-menu-content">
            <div style={{ width: 500, height: 180 }}>Learn panel</div>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
      </NavigationMenu.List>

      <NavigationMenu.Portal keepMounted>
        <NavigationMenu.Positioner data-testid="positioner">
          <NavigationMenu.Popup className="test-navigation-menu-popup" data-testid="popup-root">
            <NavigationMenu.Viewport />
          </NavigationMenu.Popup>
        </NavigationMenu.Positioner>
      </NavigationMenu.Portal>
    </NavigationMenu.Root>
  );
}

function TestNestedNavigationMenu(props: NavigationMenu.Root.Props = {}) {
  return (
    <NavigationMenu.Root {...props}>
      <NavigationMenu.List>
        <NavigationMenu.Item value="item-1">
          <NavigationMenu.Trigger data-testid="trigger-1">Item 1</NavigationMenu.Trigger>

          <NavigationMenu.Content data-testid="popup-1">
            <NavigationMenu.Link href="#link-1">Link 1</NavigationMenu.Link>
            <NavigationMenu.Root>
              <NavigationMenu.List>
                <NavigationMenu.Item value="nested-item-1">
                  <NavigationMenu.Trigger data-testid="nested-trigger-1">
                    Nested Item 1
                  </NavigationMenu.Trigger>
                  <NavigationMenu.Content data-testid="nested-popup-1">
                    <NavigationMenu.Link href="#nested-link-1">Nested Link 1</NavigationMenu.Link>
                  </NavigationMenu.Content>
                </NavigationMenu.Item>
              </NavigationMenu.List>

              <NavigationMenu.Portal>
                <NavigationMenu.Positioner side="right" data-testid="nested-positioner">
                  <NavigationMenu.Popup>
                    <NavigationMenu.Viewport />
                  </NavigationMenu.Popup>
                </NavigationMenu.Positioner>
              </NavigationMenu.Portal>
            </NavigationMenu.Root>
          </NavigationMenu.Content>
        </NavigationMenu.Item>

        <NavigationMenu.Item value="item-2">
          <NavigationMenu.Trigger data-testid="trigger-2">Item 2</NavigationMenu.Trigger>
          <NavigationMenu.Content data-testid="popup-2">
            <NavigationMenu.Link href="#link-3">Link 3</NavigationMenu.Link>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
      </NavigationMenu.List>

      <NavigationMenu.Portal>
        <NavigationMenu.Positioner data-testid="top-level-positioner">
          <NavigationMenu.Popup>
            <NavigationMenu.Viewport />
          </NavigationMenu.Popup>
        </NavigationMenu.Positioner>
      </NavigationMenu.Portal>
    </NavigationMenu.Root>
  );
}

function TestNavigationMenuOrientationAttributes() {
  return (
    <NavigationMenu.Root data-testid="top-level-root" defaultValue="item-1" orientation="vertical">
      <NavigationMenu.List data-testid="top-level-list">
        <NavigationMenu.Item value="item-1">
          <NavigationMenu.Trigger>Item 1</NavigationMenu.Trigger>
          <NavigationMenu.Content>
            <NavigationMenu.Root
              data-testid="nested-root"
              defaultValue="nested-item-1"
              orientation="vertical"
            >
              <NavigationMenu.List data-testid="nested-list">
                <NavigationMenu.Item value="nested-item-1">
                  <NavigationMenu.Trigger>Nested Item 1</NavigationMenu.Trigger>
                  <NavigationMenu.Content>
                    <NavigationMenu.Link href="#nested-link-1">Nested Link 1</NavigationMenu.Link>
                  </NavigationMenu.Content>
                </NavigationMenu.Item>
              </NavigationMenu.List>

              <NavigationMenu.Viewport />
            </NavigationMenu.Root>
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
  );
}

function TestInlineNestedNavigationMenu(
  props: {
    nestedDefaultValue?: string | number | boolean | null;
    nestedItem1Value?: string | number | boolean;
    keepMountedContent?: boolean;
    nestedLinkCloseOnClick?: boolean;
  } = {},
) {
  const {
    nestedDefaultValue = 'nested-item-1',
    nestedItem1Value = 'nested-item-1',
    keepMountedContent = false,
    nestedLinkCloseOnClick = false,
  } = props;
  const nestedRootProps =
    nestedDefaultValue == null ? undefined : { defaultValue: nestedDefaultValue };

  return (
    <NavigationMenu.Root>
      <NavigationMenu.List>
        <NavigationMenu.Item value="item-1">
          <NavigationMenu.Trigger data-testid="trigger-1">Item 1</NavigationMenu.Trigger>

          <NavigationMenu.Content data-testid="popup-1" keepMounted={keepMountedContent}>
            <NavigationMenu.Link href="#link-1">Link 1</NavigationMenu.Link>
            <NavigationMenu.Root {...nestedRootProps}>
              <NavigationMenu.List data-testid="inline-nested-list">
                <NavigationMenu.Item value={nestedItem1Value}>
                  <NavigationMenu.Trigger data-testid="nested-trigger-1">
                    Nested Item 1
                  </NavigationMenu.Trigger>
                  <NavigationMenu.Content
                    data-testid="nested-popup-1"
                    keepMounted={keepMountedContent}
                  >
                    <NavigationMenu.Link
                      href="#nested-link-1"
                      closeOnClick={nestedLinkCloseOnClick}
                    >
                      Nested Link 1
                    </NavigationMenu.Link>
                  </NavigationMenu.Content>
                </NavigationMenu.Item>
                <NavigationMenu.Item value="nested-item-2">
                  <NavigationMenu.Trigger data-testid="nested-trigger-2">
                    Nested Item 2
                  </NavigationMenu.Trigger>
                  <NavigationMenu.Content
                    data-testid="nested-popup-2"
                    keepMounted={keepMountedContent}
                  >
                    <NavigationMenu.Link href="#nested-link-2">Nested Link 2</NavigationMenu.Link>
                  </NavigationMenu.Content>
                </NavigationMenu.Item>
              </NavigationMenu.List>

              <NavigationMenu.Viewport data-testid="inline-nested-viewport" />
            </NavigationMenu.Root>
          </NavigationMenu.Content>
        </NavigationMenu.Item>

        <NavigationMenu.Item value="item-2">
          <NavigationMenu.Trigger data-testid="trigger-2">Item 2</NavigationMenu.Trigger>
          <NavigationMenu.Content data-testid="popup-2" keepMounted={keepMountedContent}>
            <NavigationMenu.Link href="#link-3">Link 3</NavigationMenu.Link>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
      </NavigationMenu.List>

      <NavigationMenu.Portal>
        <NavigationMenu.Positioner data-testid="positioner">
          <NavigationMenu.Popup data-testid="popup-root">
            <NavigationMenu.Viewport />
          </NavigationMenu.Popup>
        </NavigationMenu.Positioner>
      </NavigationMenu.Portal>
    </NavigationMenu.Root>
  );
}

function TestInlineNestedNavigationMenuWithDynamicContent({
  initialContentStage = 0,
}: {
  initialContentStage?: number;
} = {}) {
  const [contentStage, setContentStage] = React.useState(initialContentStage);

  return (
    <NavigationMenu.Root>
      <NavigationMenu.List>
        <NavigationMenu.Item value="item-1">
          <NavigationMenu.Trigger data-testid="trigger-1">Item 1</NavigationMenu.Trigger>

          <NavigationMenu.Content data-testid="popup-1">
            <NavigationMenu.Link href="#link-1">Link 1</NavigationMenu.Link>
            <NavigationMenu.Root defaultValue="nested-item-1">
              <NavigationMenu.List>
                <NavigationMenu.Item value="nested-item-1">
                  <NavigationMenu.Trigger data-testid="nested-trigger-1">
                    Nested Item 1
                  </NavigationMenu.Trigger>
                  <NavigationMenu.Content data-testid="nested-popup-1">
                    <button
                      type="button"
                      data-testid="insert-content"
                      onClick={() => {
                        setContentStage((prev) => Math.min(prev + 1, 2));
                      }}
                    >
                      Insert content
                    </button>
                    {contentStage >= 1 && (
                      <div data-testid="extra-content">
                        <NavigationMenu.Link href="#nested-link-1">
                          Nested Link 1
                        </NavigationMenu.Link>
                        <NavigationMenu.Link href="#nested-link-2">
                          Nested Link 2
                        </NavigationMenu.Link>
                        <NavigationMenu.Link href="#nested-link-3">
                          Nested Link 3
                        </NavigationMenu.Link>
                      </div>
                    )}
                    {contentStage >= 2 && (
                      <div data-testid="extra-content-2">
                        <NavigationMenu.Link href="#nested-link-4">
                          Nested Link 4
                        </NavigationMenu.Link>
                        <NavigationMenu.Link href="#nested-link-5">
                          Nested Link 5
                        </NavigationMenu.Link>
                      </div>
                    )}
                  </NavigationMenu.Content>
                </NavigationMenu.Item>
              </NavigationMenu.List>

              <NavigationMenu.Viewport />
            </NavigationMenu.Root>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
      </NavigationMenu.List>

      <NavigationMenu.Portal>
        <NavigationMenu.Positioner data-testid="positioner">
          <NavigationMenu.Popup data-testid="popup-root">
            <NavigationMenu.Viewport />
          </NavigationMenu.Popup>
        </NavigationMenu.Positioner>
      </NavigationMenu.Portal>
    </NavigationMenu.Root>
  );
}

function TestInlineNestedNavigationMenuTabForwardBoundary() {
  return (
    <NavigationMenu.Root>
      <NavigationMenu.List>
        <NavigationMenu.Item value="item-1">
          <NavigationMenu.Trigger data-testid="trigger-1">Product</NavigationMenu.Trigger>

          <NavigationMenu.Content data-testid="popup-1">
            <NavigationMenu.Root defaultValue="nested-item-2">
              <NavigationMenu.List>
                <NavigationMenu.Item value="nested-item-1">
                  <NavigationMenu.Trigger data-testid="nested-trigger-1">
                    Engineering Leads
                  </NavigationMenu.Trigger>
                  <NavigationMenu.Content data-testid="nested-popup-1">
                    <NavigationMenu.Link href="#releases">Releases</NavigationMenu.Link>
                  </NavigationMenu.Content>
                </NavigationMenu.Item>
                <NavigationMenu.Item value="nested-item-2">
                  <NavigationMenu.Trigger data-testid="nested-trigger-2">
                    Startups
                  </NavigationMenu.Trigger>
                  <NavigationMenu.Content data-testid="nested-popup-2">
                    <NavigationMenu.Link href="#quick-start">Quick start</NavigationMenu.Link>
                    <NavigationMenu.Link href="#menu">Menu</NavigationMenu.Link>
                    <NavigationMenu.Link href="#select" data-testid="nested-last-link">
                      Select
                    </NavigationMenu.Link>
                  </NavigationMenu.Content>
                </NavigationMenu.Item>
              </NavigationMenu.List>

              <NavigationMenu.Viewport />
            </NavigationMenu.Root>
          </NavigationMenu.Content>
        </NavigationMenu.Item>

        <NavigationMenu.Item value="item-2">
          <NavigationMenu.Trigger data-testid="trigger-2">Learn</NavigationMenu.Trigger>
          <NavigationMenu.Content data-testid="popup-2">
            <NavigationMenu.Link href="#learn">Learn link</NavigationMenu.Link>
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
  );
}

function TestInlineNestedNavigationMenuTabFlow() {
  return (
    <NavigationMenu.Root>
      <NavigationMenu.List>
        <NavigationMenu.Item value="item-1">
          <NavigationMenu.Trigger data-testid="trigger-product">Product</NavigationMenu.Trigger>

          <NavigationMenu.Content data-testid="popup-product">
            <NavigationMenu.Root defaultValue="developers" orientation="vertical">
              <NavigationMenu.List>
                <NavigationMenu.Item value="developers">
                  <NavigationMenu.Trigger data-testid="nested-trigger-developers">
                    Developers
                  </NavigationMenu.Trigger>
                  <NavigationMenu.Content data-testid="nested-popup-developers">
                    <NavigationMenu.Link href="#get-started" data-testid="nested-link-get-started">
                      Get started
                    </NavigationMenu.Link>
                    <NavigationMenu.Link href="#composition" data-testid="nested-link-composition">
                      Composition
                    </NavigationMenu.Link>
                  </NavigationMenu.Content>
                </NavigationMenu.Item>
                <NavigationMenu.Item value="design-systems">
                  <NavigationMenu.Trigger data-testid="nested-trigger-design-systems">
                    Design Systems
                  </NavigationMenu.Trigger>
                  <NavigationMenu.Content data-testid="nested-popup-design-systems">
                    <NavigationMenu.Link
                      href="#styling"
                      data-testid="nested-link-design-systems-styling"
                    >
                      Styling
                    </NavigationMenu.Link>
                    <NavigationMenu.Link href="#accessibility">Accessibility</NavigationMenu.Link>
                  </NavigationMenu.Content>
                </NavigationMenu.Item>
                <NavigationMenu.Item value="engineering-leads">
                  <NavigationMenu.Trigger>Engineering Leads</NavigationMenu.Trigger>
                  <NavigationMenu.Content>
                    <NavigationMenu.Link href="#releases">Releases</NavigationMenu.Link>
                  </NavigationMenu.Content>
                </NavigationMenu.Item>
              </NavigationMenu.List>

              <NavigationMenu.Viewport />
            </NavigationMenu.Root>
          </NavigationMenu.Content>
        </NavigationMenu.Item>

        <NavigationMenu.Item value="item-2">
          <NavigationMenu.Trigger data-testid="trigger-learn">Learn</NavigationMenu.Trigger>
          <NavigationMenu.Content>
            <NavigationMenu.Link href="#learn">Learn link</NavigationMenu.Link>
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
  );
}

function TestNavigationMenuWithKeepMountedContent() {
  return (
    <NavigationMenu.Root defaultValue="item-1">
      <NavigationMenu.List>
        <NavigationMenu.Item value="item-1">
          <NavigationMenu.Trigger data-testid="trigger-product">Product</NavigationMenu.Trigger>
          <NavigationMenu.Content keepMounted>
            <div style={{ width: 675, height: 220 }}>Product panel</div>
          </NavigationMenu.Content>
        </NavigationMenu.Item>

        <NavigationMenu.Item value="item-2">
          <NavigationMenu.Trigger data-testid="trigger-learn">Learn</NavigationMenu.Trigger>
          <NavigationMenu.Content keepMounted>
            <div style={{ width: 500, height: 180 }}>Learn panel</div>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
      </NavigationMenu.List>

      <NavigationMenu.Portal>
        <NavigationMenu.Positioner data-testid="positioner">
          <NavigationMenu.Popup data-testid="popup-root">
            <NavigationMenu.Viewport />
          </NavigationMenu.Popup>
        </NavigationMenu.Positioner>
      </NavigationMenu.Portal>
    </NavigationMenu.Root>
  );
}

function TestNavigationMenuWithKeepMountedContentClosed() {
  return (
    <NavigationMenu.Root>
      <NavigationMenu.List>
        <NavigationMenu.Item value="item-1">
          <NavigationMenu.Trigger data-testid="trigger-product">Product</NavigationMenu.Trigger>
          <NavigationMenu.Content keepMounted>
            <div style={{ width: 675, height: 220 }}>Product panel</div>
          </NavigationMenu.Content>
        </NavigationMenu.Item>

        <NavigationMenu.Item value="item-2">
          <NavigationMenu.Trigger data-testid="trigger-learn">Learn</NavigationMenu.Trigger>
          <NavigationMenu.Content keepMounted>
            <div style={{ width: 500, height: 180 }}>Learn panel</div>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
      </NavigationMenu.List>

      <NavigationMenu.Portal keepMounted>
        <NavigationMenu.Positioner data-testid="positioner">
          <NavigationMenu.Popup data-testid="popup-root">
            <NavigationMenu.Viewport />
          </NavigationMenu.Popup>
        </NavigationMenu.Positioner>
      </NavigationMenu.Portal>
    </NavigationMenu.Root>
  );
}

function TestNavigationMenuWithScopedPopupExitAnimation(
  props: {
    onOpenChangeComplete?: NavigationMenu.Root.Props['onOpenChangeComplete'];
  } = {},
) {
  const { onOpenChangeComplete } = props;

  return (
    <NavigationMenu.Root onOpenChangeComplete={onOpenChangeComplete}>
      {/* eslint-disable-next-line react/no-danger */}
      <style dangerouslySetInnerHTML={{ __html: scopedPopupAnimationStyles }} />
      <NavigationMenu.List>
        <NavigationMenu.Item value="item-1">
          <NavigationMenu.Trigger data-testid="trigger-product">Product</NavigationMenu.Trigger>
          <NavigationMenu.Content className="test-navigation-menu-content">
            <div style={{ width: 675, height: 220 }}>Product panel</div>
          </NavigationMenu.Content>
        </NavigationMenu.Item>

        <NavigationMenu.Item value="item-2">
          <NavigationMenu.Trigger data-testid="trigger-learn">Learn</NavigationMenu.Trigger>
          <NavigationMenu.Content className="test-navigation-menu-content">
            <div style={{ width: 500, height: 180 }}>Learn panel</div>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
      </NavigationMenu.List>

      <NavigationMenu.Portal>
        <NavigationMenu.Positioner>
          <NavigationMenu.Popup className="test-navigation-menu-popup" data-testid="popup-root">
            <NavigationMenu.Viewport />
          </NavigationMenu.Popup>
        </NavigationMenu.Positioner>
      </NavigationMenu.Portal>
    </NavigationMenu.Root>
  );
}

function mockBoundingClientRect(
  element: Element,
  rect: { x: number; y: number; width: number; height: number },
) {
  const domRect = {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    top: rect.y,
    left: rect.x,
    right: rect.x + rect.width,
    bottom: rect.y + rect.height,
    toJSON: () => ({}),
  };

  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => domRect,
  });
}

function mockAnimations(element: HTMLElement) {
  type MockAnimation = {
    finished: Promise<void>;
    resolveFinished: (() => void) | null;
  };

  function createAnimation(): MockAnimation {
    let resolveFinished: (() => void) | null = null;

    return {
      finished: new Promise<void>((resolve) => {
        resolveFinished = resolve;
      }),
      resolveFinished,
    };
  }

  let currentAnimation = createAnimation();
  let activeAnimations: MockAnimation[] = [];

  Object.defineProperty(element, 'getAnimations', {
    configurable: true,
    value: () =>
      activeAnimations.map((animation) => ({
        finished: animation.finished,
      })),
  });

  return {
    start() {
      currentAnimation = createAnimation();
      activeAnimations.push(currentAnimation);
      return currentAnimation;
    },
    finish(animation: MockAnimation = currentAnimation) {
      const finished = animation.finished;
      animation.resolveFinished?.();
      animation.resolveFinished = null;
      activeAnimations = activeAnimations.filter((item) => item !== animation);
      return finished;
    },
  };
}

function mockResizeObserver() {
  const originalResizeObserver = globalThis.ResizeObserver;

  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;

  return () => {
    globalThis.ResizeObserver = originalResizeObserver;
  };
}

function primeOpenPopupSize(
  popupRoot: HTMLElement,
  positioner: HTMLElement,
  width: number,
  height: number,
) {
  popupRoot.style.setProperty('--popup-width', 'auto');
  popupRoot.style.setProperty('--popup-height', 'auto');
  positioner.style.setProperty('--positioner-width', `${width}px`);
  positioner.style.setProperty('--positioner-height', `${height}px`);
}

function TestDeeplyNestedNavigationMenu() {
  return (
    <NavigationMenu.Root>
      <NavigationMenu.List>
        <NavigationMenu.Item value="item-1">
          <NavigationMenu.Trigger data-testid="trigger-1">Item 1</NavigationMenu.Trigger>

          <NavigationMenu.Content data-testid="content-1">
            <NavigationMenu.Link href="#link-1" data-testid="link-1">
              Link 1
            </NavigationMenu.Link>
            {/* Level 2 */}
            <NavigationMenu.Root defaultValue="level2-item-1">
              <NavigationMenu.List>
                <NavigationMenu.Item value="level2-item-1">
                  <NavigationMenu.Trigger data-testid="level2-trigger-1">
                    Level 2 Item 1
                  </NavigationMenu.Trigger>
                  <NavigationMenu.Content data-testid="level2-content-1">
                    <NavigationMenu.Link href="#level2-link-1" data-testid="level2-link-1">
                      Level 2 Link 1
                    </NavigationMenu.Link>
                    {/* Level 3 */}
                    <NavigationMenu.Root defaultValue="level3-item-1">
                      <NavigationMenu.List>
                        <NavigationMenu.Item value="level3-item-1">
                          <NavigationMenu.Trigger data-testid="level3-trigger-1">
                            Level 3 Item 1
                          </NavigationMenu.Trigger>
                          <NavigationMenu.Content data-testid="level3-content-1">
                            <NavigationMenu.Link href="#level3-link-1">
                              Level 3 Link 1
                            </NavigationMenu.Link>
                          </NavigationMenu.Content>
                        </NavigationMenu.Item>
                        <NavigationMenu.Item value="level3-item-2">
                          <NavigationMenu.Trigger data-testid="level3-trigger-2">
                            Level 3 Item 2
                          </NavigationMenu.Trigger>
                          <NavigationMenu.Content data-testid="level3-content-2">
                            <NavigationMenu.Link href="#level3-link-2">
                              Level 3 Link 2
                            </NavigationMenu.Link>
                          </NavigationMenu.Content>
                        </NavigationMenu.Item>
                      </NavigationMenu.List>
                      <NavigationMenu.Viewport />
                    </NavigationMenu.Root>
                  </NavigationMenu.Content>
                </NavigationMenu.Item>
                <NavigationMenu.Item value="level2-item-2">
                  <NavigationMenu.Trigger data-testid="level2-trigger-2">
                    Level 2 Item 2
                  </NavigationMenu.Trigger>
                  <NavigationMenu.Content data-testid="level2-content-2">
                    <NavigationMenu.Link href="#level2-link-2">Level 2 Link 2</NavigationMenu.Link>
                  </NavigationMenu.Content>
                </NavigationMenu.Item>
              </NavigationMenu.List>
              <NavigationMenu.Viewport />
            </NavigationMenu.Root>
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
  );
}

function TestNestedNavigationMenuWithCloseOnClick(props: {
  onValueChange?: NavigationMenu.Root.Props['onValueChange'];
}) {
  return (
    <NavigationMenu.Root onValueChange={props.onValueChange}>
      <NavigationMenu.List>
        <NavigationMenu.Item value="item-1">
          <NavigationMenu.Trigger data-testid="trigger-1">Item 1</NavigationMenu.Trigger>

          <NavigationMenu.Content data-testid="popup-1">
            <NavigationMenu.Link href="#link-1" closeOnClick>
              Link 1
            </NavigationMenu.Link>
            <NavigationMenu.Root>
              <NavigationMenu.List>
                <NavigationMenu.Item value="nested-item-1">
                  <NavigationMenu.Trigger data-testid="nested-trigger-1">
                    Nested Item 1
                  </NavigationMenu.Trigger>
                  <NavigationMenu.Content data-testid="nested-popup-1">
                    <NavigationMenu.Link
                      href="#nested-link-1"
                      closeOnClick
                      data-testid="nested-link-1"
                    >
                      Nested Link 1
                    </NavigationMenu.Link>
                  </NavigationMenu.Content>
                </NavigationMenu.Item>
              </NavigationMenu.List>

              <NavigationMenu.Portal>
                <NavigationMenu.Positioner side="right">
                  <NavigationMenu.Popup>
                    <NavigationMenu.Viewport />
                  </NavigationMenu.Popup>
                </NavigationMenu.Positioner>
              </NavigationMenu.Portal>
            </NavigationMenu.Root>
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
  );
}

function TestDeeplyNestedNavigationMenuWithCloseOnClick() {
  return (
    <NavigationMenu.Root>
      <NavigationMenu.List>
        <NavigationMenu.Item value="item-1">
          <NavigationMenu.Trigger data-testid="trigger-1">Item 1</NavigationMenu.Trigger>

          <NavigationMenu.Content data-testid="content-1">
            <NavigationMenu.Root defaultValue="level2-item-1">
              <NavigationMenu.List>
                <NavigationMenu.Item value="level2-item-1">
                  <NavigationMenu.Trigger data-testid="level2-trigger-1">
                    Level 2 Item 1
                  </NavigationMenu.Trigger>
                  <NavigationMenu.Content data-testid="level2-content-1">
                    <NavigationMenu.Root defaultValue="level3-item-1">
                      <NavigationMenu.List>
                        <NavigationMenu.Item value="level3-item-1">
                          <NavigationMenu.Trigger data-testid="level3-trigger-1">
                            Level 3 Item 1
                          </NavigationMenu.Trigger>
                          <NavigationMenu.Content data-testid="level3-content-1">
                            <NavigationMenu.Link
                              href="#level3-link-1"
                              closeOnClick
                              data-testid="level3-link-1"
                            >
                              Level 3 Link 1
                            </NavigationMenu.Link>
                          </NavigationMenu.Content>
                        </NavigationMenu.Item>
                      </NavigationMenu.List>
                      <NavigationMenu.Viewport />
                    </NavigationMenu.Root>
                  </NavigationMenu.Content>
                </NavigationMenu.Item>
              </NavigationMenu.List>
              <NavigationMenu.Viewport />
            </NavigationMenu.Root>
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
  );
}

function TestNavigationMenuWithNestedPopup(props: { children: React.ReactNode }) {
  const { children } = props;
  return (
    <NavigationMenu.Root>
      <NavigationMenu.List>
        <NavigationMenu.Item value="item-1">
          <NavigationMenu.Trigger data-testid="trigger-1">Item 1</NavigationMenu.Trigger>

          <NavigationMenu.Content data-testid="popup-1">{children}</NavigationMenu.Content>
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
  );
}

function TestNavigationMenuWithDialog() {
  return (
    <TestNavigationMenuWithNestedPopup>
      <Dialog.Root>
        <Dialog.Trigger data-testid="dialog-trigger">Open dialog</Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Popup
            data-testid="dialog-popup"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <button type="button" data-testid="dialog-button">
              Dialog button
            </button>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </TestNavigationMenuWithNestedPopup>
  );
}

function TestNavigationMenuWithPopover() {
  return (
    <TestNavigationMenuWithNestedPopup>
      <Popover.Root>
        <Popover.Trigger data-testid="popover-trigger">Open popover</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup
              data-testid="popover-popup"
              onClick={(event) => {
                event.stopPropagation();
              }}
            >
              <button type="button" data-testid="popover-button">
                Popover button
              </button>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </TestNavigationMenuWithNestedPopup>
  );
}

describe('<NavigationMenu.Root />', () => {
  const { render, clock } = createRenderer({
    clockOptions: {
      shouldAdvanceTime: true,
    },
  });

  clock.withFakeTimers();

  describeConformance(<NavigationMenu.Root />, () => ({
    refInstanceof: window.HTMLElement,
    render(node) {
      return render(node);
    },
  }));

  it('does not apply aria-orientation to the top-level list or root element', async () => {
    await render(<TestNavigationMenuOrientationAttributes />);

    expect(screen.getByTestId('top-level-root')).not.toHaveAttribute('aria-orientation');
    expect(screen.getByTestId('top-level-list')).not.toHaveAttribute('aria-orientation');
  });

  it('does not apply aria-orientation to nested lists or root elements', async () => {
    await render(<TestNavigationMenuOrientationAttributes />);

    expect(screen.getByTestId('nested-root')).not.toHaveAttribute('aria-orientation');
    expect(screen.getByTestId('nested-list')).not.toHaveAttribute('aria-orientation');
  });

  describe('interactions', () => {
    it('opens on hover with mouse input', async () => {
      await render(<TestNavigationMenu />);
      const trigger = screen.getByTestId('trigger-1');

      fireEvent.mouseEnter(trigger);
      fireEvent.mouseMove(trigger);
      clock.tick(50);
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-1')).not.toBe(null);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });

    it('blocks pointer events on the list while traversing from a top-level trigger to the popup', async () => {
      await render(<TestNavigationMenu />);
      const trigger = screen.getByTestId('trigger-1');
      const siblingTrigger = screen.getByTestId('trigger-2');
      const topLevelList = trigger.closest('ul') as HTMLElement;

      fireEvent.mouseEnter(trigger);
      fireEvent.mouseMove(trigger);
      clock.tick(50);
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-1')).not.toBe(null);
      expect(topLevelList.style.pointerEvents).toBe('none');
      expect(document.body.style.pointerEvents).toBe('');
      expect(getComputedStyle(siblingTrigger).pointerEvents).toBe('none');

      fireEvent.mouseEnter(screen.getByTestId('top-level-positioner'));
      await flushMicrotasks();

      expect(topLevelList.style.pointerEvents).toBe('');
    });

    it('reapplies top-level safePolygon pointer events after returning from the popup and switching triggers', async () => {
      await render(<TestNavigationMenuWithTopLevelLink />);
      const trigger1 = screen.getByTestId('trigger-1');
      const trigger2 = screen.getByTestId('trigger-2');
      const topLevelLink = screen.getByTestId('top-level-link');
      const topLevelList = trigger1.closest('ul') as HTMLElement;

      fireEvent.mouseEnter(trigger1);
      fireEvent.mouseMove(trigger1);
      clock.tick(OPEN_DELAY);
      await flushMicrotasks();

      const positioner = screen.getByTestId('top-level-positioner');

      expect(topLevelList.style.pointerEvents).toBe('none');
      expect(document.body.style.pointerEvents).toBe('');
      expect(getComputedStyle(topLevelLink).pointerEvents).toBe('none');

      fireEvent.mouseEnter(positioner);
      await flushMicrotasks();

      expect(topLevelList.style.pointerEvents).toBe('');

      fireEvent.mouseLeave(positioner, { relatedTarget: trigger1 });
      fireEvent.mouseEnter(trigger1);
      fireEvent.mouseMove(trigger1);
      await flushMicrotasks();

      expect(topLevelList.style.pointerEvents).toBe('none');
      expect(document.body.style.pointerEvents).toBe('');
      expect(getComputedStyle(topLevelLink).pointerEvents).toBe('none');

      fireEvent.mouseEnter(positioner);
      await flushMicrotasks();

      expect(topLevelList.style.pointerEvents).toBe('');

      fireEvent.mouseLeave(positioner, { relatedTarget: trigger2 });
      fireEvent.mouseEnter(trigger2);
      fireEvent.mouseMove(trigger2);
      await flushMicrotasks();

      expect(topLevelList.style.pointerEvents).toBe('none');
      expect(document.body.style.pointerEvents).toBe('');
      expect(getComputedStyle(topLevelLink).pointerEvents).toBe('none');
      expect(trigger2).toHaveAttribute('aria-expanded', 'true');
      expect(screen.queryByTestId('popup-2')).not.toBe(null);
    });

    it('keeps top-level safePolygon pointer events active when switching directly to a different trigger', async () => {
      await render(<TestNavigationMenuWithTopLevelLink />);
      const trigger1 = screen.getByTestId('trigger-1');
      const trigger2 = screen.getByTestId('trigger-2');
      const topLevelLink = screen.getByTestId('top-level-link');
      const topLevelList = trigger1.closest('ul') as HTMLElement;

      fireEvent.mouseEnter(trigger1);
      fireEvent.mouseMove(trigger1);
      clock.tick(OPEN_DELAY);
      await flushMicrotasks();

      fireEvent.mouseEnter(trigger2);
      fireEvent.mouseMove(trigger2);
      await flushMicrotasks();

      expect(topLevelList.style.pointerEvents).toBe('none');
      expect(document.body.style.pointerEvents).toBe('');
      expect(getComputedStyle(trigger1).pointerEvents).toBe('none');
      expect(getComputedStyle(topLevelLink).pointerEvents).toBe('none');
      expect(trigger1).toHaveAttribute('aria-expanded', 'false');
      expect(trigger2).toHaveAttribute('aria-expanded', 'true');
      expect(screen.queryByTestId('popup-2')).not.toBe(null);
    });

    it('clears top-level safePolygon pointer events on trigger pointerdown', async () => {
      await render(<TestNavigationMenu />);
      const trigger = screen.getByTestId('trigger-1');
      const topLevelList = trigger.closest('ul') as HTMLElement;

      fireEvent.mouseEnter(trigger);
      fireEvent.mouseMove(trigger);
      clock.tick(OPEN_DELAY);
      await flushMicrotasks();

      expect(topLevelList.style.pointerEvents).toBe('none');

      fireEvent.pointerDown(trigger, { pointerType: 'mouse' });

      expect(topLevelList.style.pointerEvents).toBe('');
    });

    it.skipIf(isJSDOM)(
      'blocks pointer events on sibling top-level triggers when opened through real hover',
      async () => {
        const { user } = await render(<TestNavigationMenu />);
        const trigger = screen.getByTestId('trigger-1');
        const siblingTrigger = screen.getByTestId('trigger-2');
        const topLevelList = trigger.closest('ul') as HTMLElement;

        await user.hover(trigger);

        await waitFor(() => {
          expect(topLevelList.style.pointerEvents).toBe('none');
        });

        expect(getComputedStyle(siblingTrigger).pointerEvents).toBe('none');
      },
    );

    it('opens on click with mouse input', async () => {
      await render(<TestNavigationMenu />);
      const trigger = screen.getByTestId('trigger-1');

      fireEvent.click(trigger);
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-1')).not.toBe(null);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });

    it('does not open on hover with touch input', async () => {
      await render(<TestNavigationMenu />);
      const trigger = screen.getByTestId('trigger-1');

      fireEvent.pointerEnter(trigger, { pointerType: 'touch' });
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-1')).toBe(null);
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });

    it('opens on click with touch input', async () => {
      await render(<TestNavigationMenu />);
      const trigger = screen.getByTestId('trigger-1');

      fireEvent.pointerDown(trigger, { pointerType: 'touch' });
      fireEvent.pointerUp(trigger, { pointerType: 'touch' });
      fireEvent.click(trigger);
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-1')).not.toBe(null);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });

    it.skipIf(isJSDOM)('restores hover open after a touch click closes outside', async () => {
      const { user } = await render(
        <div>
          <TestNavigationMenu />
          <button data-testid="outside" />
        </div>,
      );
      const trigger1 = screen.getByTestId('trigger-1');
      const trigger2 = screen.getByTestId('trigger-2');

      fireEvent.pointerEnter(trigger1, { pointerType: 'touch' });
      fireEvent.pointerDown(trigger1, { pointerType: 'touch' });
      fireEvent.pointerUp(trigger1, { pointerType: 'touch' });
      fireEvent.click(trigger1);
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-1')).not.toBe(null);

      await user.click(screen.getByTestId('outside'));
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-1')).toBe(null);

      await user.hover(trigger2);

      await waitFor(() => {
        expect(screen.queryByTestId('popup-2')).not.toBe(null);
      });
    });

    it.skipIf(isJSDOM)(
      'restores hover open after touching a nested submenu trigger and closing outside',
      async () => {
        const { user } = await render(
          <div>
            <TestInlineNestedNavigationMenu />
            <button data-testid="outside" />
          </div>,
        );
        const trigger = screen.getByTestId('trigger-1');

        fireEvent.pointerEnter(trigger, { pointerType: 'touch' });
        fireEvent.pointerDown(trigger, { pointerType: 'touch' });
        fireEvent.pointerUp(trigger, { pointerType: 'touch' });
        fireEvent.click(trigger);
        await flushMicrotasks();

        const nestedTrigger2 = screen.getByTestId('nested-trigger-2');
        fireEvent.pointerEnter(nestedTrigger2, { pointerType: 'touch' });
        fireEvent.pointerDown(nestedTrigger2, { pointerType: 'touch' });
        fireEvent.pointerUp(nestedTrigger2, { pointerType: 'touch' });
        fireEvent.click(nestedTrigger2);
        await flushMicrotasks();

        expect(screen.queryByTestId('nested-popup-2')).not.toBe(null);

        await user.click(screen.getByTestId('outside'));
        await flushMicrotasks();

        expect(screen.queryByTestId('popup-1')).toBe(null);

        await user.hover(trigger);

        await waitFor(() => {
          expect(screen.queryByTestId('popup-1')).not.toBe(null);
        });
      },
    );

    it('restores hover open after a quick click then trigger switch', async () => {
      const { user } = await render(<TestNavigationMenu />);
      const trigger1 = screen.getByTestId('trigger-1');
      const trigger2 = screen.getByTestId('trigger-2');

      await user.hover(trigger1);

      await waitFor(() => {
        expect(screen.queryByTestId('popup-1')).not.toBe(null);
      });

      await user.click(trigger1);
      await flushMicrotasks();

      await user.hover(trigger2);

      await waitFor(() => {
        expect(screen.queryByTestId('popup-2')).not.toBe(null);
      });

      await user.unhover(trigger2);

      await waitFor(() => {
        expect(screen.queryByTestId('popup-2')).toBe(null);
      });

      await user.hover(trigger1);

      await waitFor(() => {
        expect(screen.queryByTestId('popup-1')).not.toBe(null);
      });
    });

    it('closes after pointerdown on a link in a hover-open popup when pointer leaves', async () => {
      const { user } = await render(<TestNavigationMenu />);
      const trigger1 = screen.getByTestId('trigger-1');

      await user.hover(trigger1);

      await waitFor(() => {
        expect(screen.queryByTestId('popup-1')).not.toBe(null);
      });

      const popup1 = screen.getByTestId('popup-1');
      const link1 = within(popup1).getByText('Link 1');

      await user.hover(link1);
      fireEvent.pointerDown(link1, { pointerType: 'mouse' });
      await user.unhover(link1);

      await waitFor(() => {
        expect(screen.queryByTestId('popup-1')).toBe(null);
      });
    });

    it('does not close menu when clicking a different trigger with mouse', async () => {
      await render(<TestNavigationMenu />);
      const trigger1 = screen.getByTestId('trigger-1');
      const trigger2 = screen.getByTestId('trigger-2');

      fireEvent.click(trigger1);
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-1')).not.toBe(null);
      expect(trigger1).toHaveAttribute('aria-expanded', 'true');

      fireEvent.click(trigger2);
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-1')).toBe(null);
      expect(trigger1).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByTestId('popup-2')).not.toBe(null);
      expect(trigger2).toHaveAttribute('aria-expanded', 'true');
    });

    it('does not close menu when clicking a different trigger on touch', async () => {
      await render(<TestNavigationMenu />);
      const trigger1 = screen.getByTestId('trigger-1');
      const trigger2 = screen.getByTestId('trigger-2');

      fireEvent.click(trigger1);
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-1')).not.toBe(null);
      expect(trigger1).toHaveAttribute('aria-expanded', 'true');

      fireEvent.pointerDown(trigger2, { pointerType: 'touch' });
      fireEvent.pointerUp(trigger2, { pointerType: 'touch' });
      fireEvent.click(trigger2);
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-1')).toBe(null);
      expect(trigger1).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByTestId('popup-2')).not.toBe(null);
      expect(trigger2).toHaveAttribute('aria-expanded', 'true');
    });

    it('returns focus to trigger when closing menu', async () => {
      const { user } = await render(
        <div>
          <button data-testid="first" />
          <TestNavigationMenu />
          <button data-testid="last" />
        </div>,
      );

      const trigger = screen.getByTestId('trigger-1');

      await user.click(trigger);
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-1')).not.toBe(null);
      expect(trigger).toHaveFocus();

      await user.keyboard('{Escape}');
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-1')).toBe(null);
      expect(trigger).toHaveFocus();
    });

    it('respects focus outside when clicking menu', async () => {
      const { user } = await render(
        <div>
          <button data-testid="first" />
          <TestNavigationMenu />
          <button data-testid="last" />
        </div>,
      );

      const trigger = screen.getByTestId('trigger-1');
      const last = screen.getByTestId('last');

      await user.click(trigger);
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-1')).not.toBe(null);
      expect(trigger).toHaveFocus();

      await user.click(screen.getByTestId('last'));
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-1')).toBe(null);
      expect(last).toHaveFocus();
    });

    it('does not restore focus to the trigger when closed via hover', async () => {
      await render(<TestNavigationMenu />);
      const trigger = screen.getByTestId('trigger-1');

      fireEvent.mouseEnter(trigger);
      fireEvent.mouseMove(trigger);
      clock.tick(OPEN_DELAY);

      const popup = await screen.findByTestId('popup-1');
      expect(trigger).toHaveAttribute('aria-expanded', 'true');

      fireEvent.mouseLeave(trigger);
      fireEvent.mouseLeave(popup);
      clock.tick(50);

      await waitFor(() => {
        expect(screen.queryByTestId('popup-1')).toBe(null);
      });
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(trigger).not.toHaveFocus();
    });

    it('does not restore focus to the trigger when focus moves outside', async () => {
      const { user } = await render(
        <div>
          <button data-testid="first" />
          <TestNavigationMenu />
          <button data-testid="last" />
        </div>,
      );

      const trigger = screen.getByTestId('trigger-1');
      const last = screen.getByTestId('last');

      await act(async () => trigger.focus());

      await user.click(trigger);
      await user.tab();
      await user.tab();
      await user.tab();
      await user.tab();

      await waitFor(() => {
        expect(screen.queryByTestId('popup-1')).toBe(null);
      });
      expect(last).toHaveFocus();
      expect(trigger).not.toHaveFocus();
    });
  });

  describe('patient click threshold', () => {
    it('closes if hovered then clicked after the patient threshold', async () => {
      await render(<TestNavigationMenu />);
      const trigger = screen.getByTestId('trigger-1');

      fireEvent.click(trigger);
      clock.tick(OPEN_DELAY);
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-1')).not.toBe(null);

      clock.tick(PATIENT_CLICK_THRESHOLD);

      fireEvent.click(trigger);
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-1')).toBe(null);
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('prop: defaultValue', () => {
    it('should respect defaultValue', async () => {
      await render(<TestNavigationMenu defaultValue="item-1" />);
      const trigger = screen.getByTestId('trigger-1');

      fireEvent.mouseEnter(trigger);
      fireEvent.mouseMove(trigger);
      clock.tick(OPEN_DELAY);
      await flushMicrotasks();
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });

    it('disables popup and arrow transitions while a kept portal opens', async () => {
      await render(
        <NavigationMenu.Root>
          <NavigationMenu.List>
            <NavigationMenu.Item value="item-1">
              <NavigationMenu.Trigger data-testid="trigger-1">Item 1</NavigationMenu.Trigger>
              <NavigationMenu.Content>
                <NavigationMenu.Link href="#link-1">Link 1</NavigationMenu.Link>
              </NavigationMenu.Content>
            </NavigationMenu.Item>
          </NavigationMenu.List>
          <NavigationMenu.Portal keepMounted>
            <NavigationMenu.Positioner>
              <NavigationMenu.Popup data-testid="popup-root">
                <NavigationMenu.Arrow data-testid="arrow" />
                <NavigationMenu.Viewport />
              </NavigationMenu.Popup>
            </NavigationMenu.Positioner>
          </NavigationMenu.Portal>
        </NavigationMenu.Root>,
      );

      fireEvent.click(screen.getByTestId('trigger-1'));

      expect(screen.getByTestId('popup-root')).toHaveStyle({
        transition: 'none',
      });
      expect(screen.getByTestId('arrow')).toHaveStyle({
        transition: 'none',
      });

      await waitFor(() => {
        expect(screen.getByTestId('popup-root')).not.toHaveStyle({
          transition: 'none',
        });
      });
      expect(screen.getByTestId('arrow')).not.toHaveStyle({
        transition: 'none',
      });
    });
  });

  describe('prop: onValueChange', () => {
    it('should call onValueChange when value changes', async () => {
      const onValueChange = vi.fn();
      await render(<TestNavigationMenu onValueChange={onValueChange} />);
      const trigger1 = screen.getByTestId('trigger-1');
      const trigger2 = screen.getByTestId('trigger-2');

      fireEvent.click(trigger1);
      await flushMicrotasks();
      expect(onValueChange.mock.calls.length).toBe(1);
      expect(onValueChange.mock.lastCall?.[0]).toBe('item-1');

      fireEvent.click(trigger2);
      await flushMicrotasks();
      expect(onValueChange.mock.calls.length).toBe(2);
      expect(onValueChange.mock.lastCall?.[0]).toBe('item-2');
    });

    it('does not emit a duplicate onValueChange when switching items via keyboard', async () => {
      const onValueChange = vi.fn();
      const { user } = await render(<TestNavigationMenu onValueChange={onValueChange} />);
      const trigger1 = screen.getByTestId('trigger-1');
      const trigger2 = screen.getByTestId('trigger-2');

      await user.click(trigger1);
      await flushMicrotasks();
      expect(onValueChange.mock.calls.length).toBe(1);
      expect(onValueChange.mock.lastCall?.[0]).toBe('item-1');

      await act(async () => {
        trigger1.focus();
      });
      await user.keyboard('{ArrowRight}');
      await flushMicrotasks();
      expect(trigger2).toHaveFocus();
      expect(onValueChange.mock.calls.filter((call) => call[0] === 'item-2')).toHaveLength(0);

      await user.keyboard('{ArrowDown}');
      await flushMicrotasks();

      expect(onValueChange.mock.calls.filter((call) => call[0] === 'item-2')).toHaveLength(1);
      expect(trigger2).toHaveAttribute('aria-expanded', 'true');
    });

    it.each(falsyNavigationMenuValueCases)(
      'treats a falsy item value (%s) as a valid open value',
      async (_label, itemValue) => {
        const onValueChange = vi.fn();
        await render(
          <NavigationMenu.Root<FalsyNavigationMenuValue> onValueChange={onValueChange}>
            <NavigationMenu.List>
              <NavigationMenu.Item value={itemValue}>
                <NavigationMenu.Trigger data-testid="trigger-0">Zero</NavigationMenu.Trigger>
                <NavigationMenu.Content data-testid="popup-0">
                  <NavigationMenu.Link href="#link-0">Zero link</NavigationMenu.Link>
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
          </NavigationMenu.Root>,
        );

        const trigger = screen.getByTestId('trigger-0');

        fireEvent.click(trigger);
        await flushMicrotasks();

        expect(onValueChange.mock.calls.length).toBe(1);
        expect(onValueChange.mock.lastCall?.[0]).toBe(itemValue);
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
        expect(screen.queryByTestId('popup-0')).not.toBe(null);
      },
    );

    it('should be controlled by value prop', async () => {
      const { setProps } = await render(<TestNavigationMenu value="item-1" />);

      let trigger1 = screen.getByTestId('trigger-1');
      fireEvent.mouseEnter(trigger1);
      fireEvent.mouseMove(trigger1);
      clock.tick(OPEN_DELAY);
      await flushMicrotasks();
      expect(trigger1).toHaveAttribute('aria-expanded', 'true');

      await setProps({ value: 'item-2' });

      const trigger2 = screen.getByTestId('trigger-2');
      fireEvent.mouseLeave(trigger1);
      fireEvent.mouseEnter(trigger2);
      fireEvent.mouseMove(trigger2);
      await flushMicrotasks();

      trigger1 = screen.getByTestId('trigger-1');
      expect(trigger1).toHaveAttribute('aria-expanded', 'false');
      expect(trigger2).toHaveAttribute('aria-expanded', 'true');
    });

    async function assertPopupSizeIsPreservedWhenControlledValueClosesExternally(
      keepMountedPortal = false,
    ) {
      const previousAnimationsDisabled = globalThis.BASE_UI_ANIMATIONS_DISABLED;
      const originalOffsetWidth = Object.getOwnPropertyDescriptor(
        HTMLElement.prototype,
        'offsetWidth',
      );
      const originalOffsetHeight = Object.getOwnPropertyDescriptor(
        HTMLElement.prototype,
        'offsetHeight',
      );
      globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

      try {
        function isPopupOpen() {
          return screen.queryByTestId('popup-1')?.hasAttribute('data-open') ?? false;
        }

        Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
          configurable: true,
          get() {
            if (this.getAttribute('data-testid') === 'popup-root') {
              return isPopupOpen() ? 675 : 0;
            }

            return originalOffsetWidth?.get?.call(this) ?? 0;
          },
        });
        Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
          configurable: true,
          get() {
            if (this.getAttribute('data-testid') === 'popup-root') {
              return isPopupOpen() ? 220 : 0;
            }

            return originalOffsetHeight?.get?.call(this) ?? 0;
          },
        });

        function ControlledNavigationMenu(props: { value: string | null }) {
          return <TestNavigationMenu value={props.value} keepMountedPortal={keepMountedPortal} />;
        }

        const { rerender } = await render(<ControlledNavigationMenu value="item-1" />);

        const positioner = screen.getByTestId('top-level-positioner');
        const popupRoot = screen.getByTestId('popup-root');
        const animations = mockAnimations(popupRoot);

        animations.start();
        await rerender(<ControlledNavigationMenu value={null} />);
        await flushMicrotasks();

        expect(popupRoot).toHaveAttribute('data-ending-style');
        expect(popupRoot.style.getPropertyValue('--popup-width')).toBe('675px');
        expect(popupRoot.style.getPropertyValue('--popup-height')).toBe('220px');
        expect(positioner.style.getPropertyValue('--positioner-width')).toBe('675px');
        expect(positioner.style.getPropertyValue('--positioner-height')).toBe('220px');

        await act(async () => {
          animations.finish();
          await flushMicrotasks();
        });
      } finally {
        globalThis.BASE_UI_ANIMATIONS_DISABLED = previousAnimationsDisabled;
        if (originalOffsetWidth) {
          Object.defineProperty(HTMLElement.prototype, 'offsetWidth', originalOffsetWidth);
        } else {
          Reflect.deleteProperty(HTMLElement.prototype, 'offsetWidth');
        }
        if (originalOffsetHeight) {
          Object.defineProperty(HTMLElement.prototype, 'offsetHeight', originalOffsetHeight);
        } else {
          Reflect.deleteProperty(HTMLElement.prototype, 'offsetHeight');
        }
      }
    }

    it('preserves popup size when controlled value closes externally', async () => {
      await assertPopupSizeIsPreservedWhenControlledValueClosesExternally();
    });

    it('preserves popup size when controlled value closes externally with keepMounted portal', async () => {
      await assertPopupSizeIsPreservedWhenControlledValueClosesExternally(true);
    });

    it('clears activation direction when controlled value closes externally after switching triggers', async () => {
      const previousAnimationsDisabled = globalThis.BASE_UI_ANIMATIONS_DISABLED;
      globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

      try {
        function ControlledNavigationMenu(props: { value: string | null }) {
          return <TestNavigationMenu value={props.value} />;
        }

        const { rerender } = await render(<ControlledNavigationMenu value="item-1" />);

        const trigger1 = screen.getByTestId('trigger-1');
        const trigger2 = screen.getByTestId('trigger-2');

        mockBoundingClientRect(trigger1, { x: 0, y: 0, width: 80, height: 32 });
        mockBoundingClientRect(trigger2, { x: 120, y: 0, width: 80, height: 32 });

        fireEvent.click(trigger2);
        await rerender(<ControlledNavigationMenu value="item-2" />);

        expect(screen.getByTestId('popup-2')).toHaveAttribute('data-activation-direction', 'right');

        const exitingContent = screen.getByTestId('popup-2');
        const animations = mockAnimations(exitingContent);

        animations.start();
        await rerender(<ControlledNavigationMenu value={null} />);

        expect(exitingContent).toHaveAttribute('data-ending-style');
        expect(exitingContent).not.toHaveAttribute('data-activation-direction');

        await act(async () => {
          animations.finish();
          await flushMicrotasks();
        });
      } finally {
        globalThis.BASE_UI_ANIMATIONS_DISABLED = previousAnimationsDisabled;
      }
    });
  });

  describe('prop: delay', () => {
    it('respects custom delay value', async () => {
      const customDelay = 100;
      await render(<TestNavigationMenu delay={customDelay} />);
      const trigger = screen.getByTestId('trigger-1');

      fireEvent.mouseEnter(trigger);
      fireEvent.mouseMove(trigger);
      clock.tick(customDelay - 25);
      await flushMicrotasks();

      // Menu shouldn't be open yet since we're before the delay
      expect(screen.queryByTestId('popup-1')).toBe(null);

      clock.tick(50);
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-1')).not.toBe(null);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });
  });

  describe('prop: closeDelay', () => {
    it('respects custom closeDelay value', async () => {
      const customCloseDelay = 100;
      await render(<TestNavigationMenu closeDelay={customCloseDelay} />);
      const trigger = screen.getByTestId('trigger-1');

      fireEvent.mouseEnter(trigger);
      fireEvent.mouseMove(trigger);
      clock.tick(OPEN_DELAY);
      await flushMicrotasks();
      expect(screen.queryByTestId('popup-1')).not.toBe(null);

      fireEvent.mouseLeave(trigger);
      clock.tick(customCloseDelay - 25);
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-1')).not.toBe(null);

      // Complete the closeDelay
      clock.tick(50);
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-1')).toBe(null);
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('prop: disabled', () => {
    it('does not open on hover when the trigger is disabled', async () => {
      const onValueChange = vi.fn();
      await render(<TestNavigationMenuWithDisabledTrigger onValueChange={onValueChange} />);
      const trigger = screen.getByTestId('trigger-1');

      fireEvent.mouseEnter(trigger);
      fireEvent.mouseMove(trigger);
      clock.tick(OPEN_DELAY);
      await flushMicrotasks();

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByTestId('popup-1')).toBe(null);
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('does not open on click when the trigger is disabled', async () => {
      const onValueChange = vi.fn();
      await render(<TestNavigationMenuWithDisabledTrigger onValueChange={onValueChange} />);
      const trigger = screen.getByTestId('trigger-1');

      fireEvent.click(trigger);
      await flushMicrotasks();

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByTestId('popup-1')).toBe(null);
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('does not open on touch when the trigger is disabled', async () => {
      const onValueChange = vi.fn();
      await render(<TestNavigationMenuWithDisabledTrigger onValueChange={onValueChange} />);
      const trigger = screen.getByTestId('trigger-1');

      fireEvent.pointerDown(trigger, { pointerType: 'touch' });
      fireEvent.pointerUp(trigger, { pointerType: 'touch' });
      fireEvent.click(trigger);
      await flushMicrotasks();

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByTestId('popup-1')).toBe(null);
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('does not open via keyboard when the trigger is disabled', async () => {
      const onValueChange = vi.fn();
      const { user } = await render(
        <TestNavigationMenuWithDisabledTrigger onValueChange={onValueChange} />,
      );
      const trigger = screen.getByTestId('trigger-1');

      await act(async () => {
        trigger.focus();
      });
      await user.keyboard('{ArrowDown}');
      await flushMicrotasks();

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByTestId('popup-1')).toBe(null);
      expect(onValueChange).not.toHaveBeenCalled();
    });
  });

  describe('prop: actionsRef', () => {
    it('exposes an unmount action and defers unmounting until it is called', async () => {
      const actionsRef = React.createRef<NavigationMenu.Root.Actions>();

      function ControlledNavigationMenu(props: { value: string | null }) {
        return <TestNavigationMenu value={props.value} actionsRef={actionsRef} />;
      }

      const { rerender } = await render(<ControlledNavigationMenu value="item-1" />);

      expect(actionsRef.current).not.toBe(null);
      expect(actionsRef.current?.unmount).toBeTypeOf('function');
      expect(screen.queryByTestId('popup-root')).not.toBe(null);

      // Closing keeps the popup mounted because `actionsRef` disables the automatic unmount.
      await rerender(<ControlledNavigationMenu value={null} />);
      await flushMicrotasks();
      expect(screen.queryByTestId('popup-root')).not.toBe(null);

      await act(async () => {
        actionsRef.current?.unmount();
      });
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-root')).toBe(null);
    });

    it('unmounts immediately when called while the popup is closing', async () => {
      const previousAnimationsDisabled = globalThis.BASE_UI_ANIMATIONS_DISABLED;
      globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

      try {
        const actionsRef = React.createRef<NavigationMenu.Root.Actions>();

        function ControlledNavigationMenu(props: { value: string | null }) {
          return <TestNavigationMenu value={props.value} actionsRef={actionsRef} />;
        }

        const { rerender } = await render(<ControlledNavigationMenu value="item-1" />);

        const popupRoot = screen.getByTestId('popup-root');
        const animations = mockAnimations(popupRoot);
        const closingAnimation = animations.start();

        await rerender(<ControlledNavigationMenu value={null} />);
        await flushMicrotasks();

        expect(popupRoot).toHaveAttribute('data-ending-style');

        await act(async () => {
          actionsRef.current?.unmount();
        });
        await flushMicrotasks();

        expect(screen.queryByTestId('popup-root')).toBe(null);

        await act(async () => {
          animations.finish(closingAnimation);
          await flushMicrotasks();
        });
      } finally {
        globalThis.BASE_UI_ANIMATIONS_DISABLED = previousAnimationsDisabled;
      }
    });
  });

  describe('prop: side', () => {
    it.each([
      ['left in LTR', 'ltr', 'left'],
      ['inline-start in LTR', 'ltr', 'inline-start'],
      ['inline-end in RTL', 'rtl', 'inline-end'],
    ] as const)(
      'pins the popup to the right edge when side is %s so it grows leftward',
      async (_label, direction, side) => {
        await render(
          <DirectionProvider direction={direction as TextDirection}>
            <NavigationMenu.Root>
              <NavigationMenu.List>
                <NavigationMenu.Item value="item-1">
                  <NavigationMenu.Trigger data-testid="trigger-1">Item 1</NavigationMenu.Trigger>
                  <NavigationMenu.Content>
                    <NavigationMenu.Link href="#link-1">Link 1</NavigationMenu.Link>
                  </NavigationMenu.Content>
                </NavigationMenu.Item>
              </NavigationMenu.List>
              <NavigationMenu.Portal>
                <NavigationMenu.Positioner side={side}>
                  <NavigationMenu.Popup data-testid="popup-root">
                    <NavigationMenu.Viewport />
                  </NavigationMenu.Popup>
                </NavigationMenu.Positioner>
              </NavigationMenu.Portal>
            </NavigationMenu.Root>
          </DirectionProvider>,
        );

        const trigger = screen.getByTestId('trigger-1');
        fireEvent.click(trigger);
        await flushMicrotasks();

        const popup = screen.getByTestId('popup-root');
        expect(popup).toHaveAttribute('data-side', side);
        expect(popup).toHaveStyle({ position: 'absolute', top: '0px', right: '0px' });
      },
    );
  });

  describe('tabbing', () => {
    it('moves focus through the menu correctly', async () => {
      const { user } = await render(
        <div>
          <button data-testid="first" />
          <TestNavigationMenu />
        </div>,
      );
      const trigger1 = screen.getByTestId('trigger-1');

      await act(async () => trigger1.focus());

      fireEvent.click(trigger1);
      await flushMicrotasks();

      expect(screen.getByTestId('popup-1')).not.toBe(null);
      expect(trigger1).toHaveFocus();

      await user.tab();
      expect(screen.getByText('Link 1')).toHaveFocus();

      await user.tab();
      expect(screen.getByText('Link 2')).toHaveFocus();

      await user.tab();
      expect(screen.getByTestId('trigger-2')).toHaveFocus();

      fireEvent.click(screen.getByTestId('trigger-2'));
      await flushMicrotasks();

      expect(screen.getByTestId('popup-2')).not.toBe(null);

      await user.tab();
      expect(screen.getByText('Link 3')).toHaveFocus();

      await user.tab();
      expect(screen.getByText('Link 4')).toHaveFocus();

      await user.tab({ shift: true });
      await user.tab({ shift: true });
      await user.tab({ shift: true });

      expect(trigger1).toHaveFocus();
    });

    it('closes the menu when tabbing forward out', async () => {
      const { user } = await render(
        <div>
          <button data-testid="first" />
          <TestNavigationMenu />
          <button data-testid="last" />
        </div>,
      );
      const trigger = screen.getByTestId('trigger-1');

      await act(async () => trigger.focus());
      fireEvent.click(trigger);
      await flushMicrotasks();

      expect(screen.getByTestId('popup-1')).not.toBe(null);
      expect(trigger).toHaveFocus();

      await user.tab(); // Link 1
      await user.tab(); // Link 2
      await user.tab(); // trigger 2
      await user.tab(); // last

      expect(screen.queryByTestId('popup-1')).toBe(null);
    });

    it('returns to the last submenu item when shift+tabbing after tabbing out of it', async () => {
      const { user } = await render(
        <div>
          <button data-testid="first" />
          <TestNavigationMenu />
          <button data-testid="last" />
        </div>,
      );
      const trigger = screen.getByTestId('trigger-1');

      await act(async () => trigger.focus());
      fireEvent.click(trigger);
      await flushMicrotasks();

      expect(screen.getByTestId('popup-1')).not.toBe(null);
      expect(trigger).toHaveFocus();

      await user.tab();
      expect(screen.getByText('Link 1')).toHaveFocus();

      await user.tab();
      expect(screen.getByText('Link 2')).toHaveFocus();

      await user.tab();
      expect(screen.getByTestId('trigger-2')).toHaveFocus();

      await user.tab({ shift: true });
      expect(screen.getByText('Link 2')).toHaveFocus();
    });

    it('closes the menu when tabbing back out', async () => {
      const { user } = await render(
        <div>
          <button data-testid="first" />
          <TestNavigationMenu />
        </div>,
      );
      const trigger = screen.getByTestId('trigger-1');

      await act(async () => trigger.focus());
      fireEvent.click(trigger);
      await flushMicrotasks();

      expect(screen.getByTestId('popup-1')).not.toBe(null);
      expect(trigger).toHaveFocus();

      await user.tab();
      expect(screen.getByText('Link 1')).toHaveFocus();

      await user.tab({ shift: true }); // trigger 1
      await user.tab({ shift: true }); // first

      expect(screen.queryByTestId('popup-1')).toBe(null);
    });
  });

  describe('nested popups', () => {
    it('keeps a hover-open menu open when pointerdown happens on a nested dialog trigger', async () => {
      const { user } = await render(<TestNavigationMenuWithDialog />);
      const trigger = screen.getByTestId('trigger-1');

      fireEvent.mouseEnter(trigger);
      fireEvent.mouseMove(trigger);
      clock.tick(OPEN_DELAY);
      await flushMicrotasks();

      const popup = screen.getByTestId('popup-1');
      const dialogTrigger = screen.getByTestId('dialog-trigger');

      fireEvent.pointerDown(dialogTrigger, { pointerType: 'mouse' });
      fireEvent.mouseLeave(popup);

      await user.click(dialogTrigger);

      expect(await screen.findByTestId('dialog-popup')).not.toBe(null);
      expect(screen.queryByTestId('popup-1')).not.toBe(null);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });

    it('keeps the menu open when interacting with a nested dialog', async () => {
      const { user } = await render(<TestNavigationMenuWithDialog />);
      const trigger = screen.getByTestId('trigger-1');

      await user.click(trigger);

      await waitFor(() => {
        expect(screen.queryByTestId('popup-1')).not.toBe(null);
      });
      expect(trigger).toHaveAttribute('aria-expanded', 'true');

      const dialogTrigger = screen.getByTestId('dialog-trigger');
      await user.click(dialogTrigger);

      expect(await screen.findByTestId('dialog-popup')).not.toBe(null);

      await user.click(screen.getByTestId('dialog-button'));

      await waitFor(() => {
        expect(screen.queryByTestId('popup-1')).not.toBe(null);
      });
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });

    it('keeps the menu open when interacting with a nested popover', async () => {
      const { user } = await render(<TestNavigationMenuWithPopover />);
      const trigger = screen.getByTestId('trigger-1');

      await user.click(trigger);

      await waitFor(() => {
        expect(screen.queryByTestId('popup-1')).not.toBe(null);
      });
      expect(trigger).toHaveAttribute('aria-expanded', 'true');

      const popoverTrigger = screen.getByTestId('popover-trigger');
      await user.click(popoverTrigger);

      expect(await screen.findByTestId('popover-popup')).not.toBe(null);

      await user.click(screen.getByTestId('popover-button'));

      await waitFor(() => {
        expect(screen.queryByTestId('popup-1')).not.toBe(null);
      });
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });
  });

  describe('nested menus', () => {
    it('opens nested menu on hover and stays open when hovering over nested popup', async () => {
      await render(<TestNestedNavigationMenu />);
      const trigger1 = screen.getByTestId('trigger-1');

      fireEvent.mouseEnter(trigger1);
      fireEvent.mouseMove(trigger1);
      clock.tick(OPEN_DELAY);
      await flushMicrotasks();

      const popup1 = screen.getByTestId('popup-1');
      expect(popup1).not.toBe(null);
      expect(trigger1).toHaveAttribute('aria-expanded', 'true');

      const nestedTrigger1 = within(popup1).getByTestId('nested-trigger-1');

      fireEvent.mouseEnter(nestedTrigger1);
      fireEvent.mouseMove(nestedTrigger1);
      clock.tick(OPEN_DELAY);
      await flushMicrotasks();

      const nestedPopup1 = screen.getByTestId('nested-popup-1');
      expect(nestedPopup1).not.toBe(null);
      expect(nestedTrigger1).toHaveAttribute('aria-expanded', 'true');

      fireEvent.mouseEnter(nestedPopup1);
      fireEvent.mouseMove(nestedPopup1);
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-1')).not.toBe(null);
      expect(screen.queryByTestId('nested-popup-1')).not.toBe(null);
      expect(trigger1).toHaveAttribute('aria-expanded', 'true');
      expect(nestedTrigger1).toHaveAttribute('aria-expanded', 'true');
    });

    it('handles inline nested menu without positioner/popup correctly', async () => {
      await render(<TestInlineNestedNavigationMenu />);
      const trigger1 = screen.getByTestId('trigger-1');

      fireEvent.mouseEnter(trigger1);
      fireEvent.mouseMove(trigger1);
      clock.tick(OPEN_DELAY);
      await flushMicrotasks();

      const popup1 = screen.getByTestId('popup-1');
      expect(popup1).not.toBe(null);
      expect(trigger1).toHaveAttribute('aria-expanded', 'true');

      const nestedTrigger1 = within(popup1).getByTestId('nested-trigger-1');

      fireEvent.mouseEnter(nestedTrigger1);
      fireEvent.mouseMove(nestedTrigger1);
      clock.tick(OPEN_DELAY);
      await flushMicrotasks();

      const nestedPopup1 = screen.getByTestId('nested-popup-1');
      expect(nestedPopup1).not.toBe(null);
      expect(nestedTrigger1).toHaveAttribute('aria-expanded', 'true');

      fireEvent.mouseEnter(nestedPopup1);
      fireEvent.mouseMove(nestedPopup1);
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-1')).not.toBe(null);
      expect(screen.queryByTestId('nested-popup-1')).not.toBe(null);
      expect(trigger1).toHaveAttribute('aria-expanded', 'true');
      expect(nestedTrigger1).toHaveAttribute('aria-expanded', 'true');

      const nestedTrigger2 = within(popup1).getByTestId('nested-trigger-2');
      fireEvent.mouseEnter(nestedTrigger2);
      fireEvent.mouseMove(nestedTrigger2);
      clock.tick(OPEN_DELAY);
      await flushMicrotasks();

      const nestedPopup2 = screen.getByTestId('nested-popup-2');
      expect(nestedPopup2).not.toBe(null);
      expect(nestedTrigger2).toHaveAttribute('aria-expanded', 'true');
      expect(nestedTrigger1).toHaveAttribute('aria-expanded', 'false');
    });

    it('keeps parent menu open when hovering inline nested triggers without defaultValue', async () => {
      await render(<TestInlineNestedNavigationMenu nestedDefaultValue={null} />);
      const trigger1 = screen.getByTestId('trigger-1');

      fireEvent.mouseEnter(trigger1);
      fireEvent.mouseMove(trigger1);
      clock.tick(OPEN_DELAY);
      await flushMicrotasks();

      const popup1 = screen.getByTestId('popup-1');
      const nestedTrigger1 = within(popup1).getByTestId('nested-trigger-1');
      expect(nestedTrigger1).toHaveAttribute('aria-expanded', 'false');

      fireEvent.mouseEnter(nestedTrigger1);
      fireEvent.mouseMove(nestedTrigger1);
      clock.tick(OPEN_DELAY);
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-1')).not.toBe(null);
      expect(trigger1).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByTestId('nested-popup-1')).not.toBe(null);
      expect(nestedTrigger1).toHaveAttribute('aria-expanded', 'true');

      const nestedTrigger2 = within(popup1).getByTestId('nested-trigger-2');
      fireEvent.mouseEnter(nestedTrigger2);
      fireEvent.mouseMove(nestedTrigger2);
      clock.tick(OPEN_DELAY);
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-1')).not.toBe(null);
      expect(trigger1).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByTestId('nested-popup-2')).not.toBe(null);
      expect(nestedTrigger2).toHaveAttribute('aria-expanded', 'true');
    });

    it('closes the parent menu after a nested submenu closes on delayed hover-out', async () => {
      const closeDelay = 200;

      await render(<TestNestedNavigationMenu closeDelay={closeDelay} />);
      const trigger1 = screen.getByTestId('trigger-1');

      fireEvent.mouseEnter(trigger1);
      fireEvent.mouseMove(trigger1);
      clock.tick(OPEN_DELAY);
      await flushMicrotasks();

      const popup1 = screen.getByTestId('popup-1');
      const nestedTrigger1 = within(popup1).getByTestId('nested-trigger-1');
      const topLevelPositioner = screen.getByTestId('top-level-positioner');

      fireEvent.mouseEnter(nestedTrigger1);
      fireEvent.mouseMove(nestedTrigger1);
      clock.tick(OPEN_DELAY);
      await flushMicrotasks();

      const nestedPopup1 = screen.getByTestId('nested-popup-1');
      const nestedPositioner = screen.getByTestId('nested-positioner');
      expect(nestedPopup1).not.toBe(null);

      fireEvent.mouseLeave(nestedTrigger1);
      fireEvent.mouseLeave(nestedPositioner);
      fireEvent.mouseLeave(topLevelPositioner);
      clock.tick(closeDelay);
      await flushMicrotasks();

      expect(screen.queryByTestId('nested-popup-1')).toBe(null);
      expect(screen.queryByTestId('popup-1')).toBe(null);
      expect(trigger1).toHaveAttribute('aria-expanded', 'false');
    });

    it('closes the parent menu when a nested link with closeOnClick is clicked', async () => {
      const { user } = await render(<TestNestedNavigationMenuWithCloseOnClick />);
      const trigger1 = screen.getByTestId('trigger-1');

      await user.click(trigger1);

      await waitFor(() => {
        expect(screen.queryByTestId('popup-1')).not.toBe(null);
      });

      const popup1 = screen.getByTestId('popup-1');
      const nestedTrigger1 = within(popup1).getByTestId('nested-trigger-1');

      fireEvent.mouseEnter(nestedTrigger1);
      fireEvent.mouseMove(nestedTrigger1);
      clock.tick(OPEN_DELAY);
      await flushMicrotasks();

      expect(screen.queryByTestId('nested-popup-1')).not.toBe(null);

      const nestedLink = screen.getByTestId('nested-link-1');
      await user.click(nestedLink);

      await waitFor(() => {
        expect(screen.queryByTestId('nested-popup-1')).toBe(null);
      });
      expect(screen.queryByTestId('popup-1')).toBe(null);
      expect(trigger1).toHaveAttribute('aria-expanded', 'false');
    });

    it('calls onValueChange on the parent root when nested closeOnClick link is clicked', async () => {
      const onValueChange = vi.fn();
      const { user } = await render(
        <TestNestedNavigationMenuWithCloseOnClick onValueChange={onValueChange} />,
      );
      const trigger1 = screen.getByTestId('trigger-1');

      await user.click(trigger1);

      await waitFor(() => {
        expect(screen.queryByTestId('popup-1')).not.toBe(null);
      });

      const popup1 = screen.getByTestId('popup-1');
      const nestedTrigger1 = within(popup1).getByTestId('nested-trigger-1');

      fireEvent.mouseEnter(nestedTrigger1);
      fireEvent.mouseMove(nestedTrigger1);
      clock.tick(OPEN_DELAY);
      await flushMicrotasks();

      const nestedLink = screen.getByTestId('nested-link-1');
      await user.click(nestedLink);

      await waitFor(() => {
        expect(onValueChange.mock.lastCall?.[0]).toBe(null);
      });
    });

    it('closes all levels when a deeply nested link with closeOnClick is clicked', async () => {
      const { user } = await render(<TestDeeplyNestedNavigationMenuWithCloseOnClick />);
      const trigger1 = screen.getByTestId('trigger-1');

      await user.click(trigger1);

      await waitFor(() => {
        expect(screen.queryByTestId('content-1')).not.toBe(null);
      });

      expect(screen.queryByTestId('level2-content-1')).not.toBe(null);
      expect(screen.queryByTestId('level3-content-1')).not.toBe(null);

      const level3Link = screen.getByTestId('level3-link-1');
      await user.click(level3Link);

      await waitFor(() => {
        expect(screen.queryByTestId('level3-content-1')).toBe(null);
      });
      expect(screen.queryByTestId('level2-content-1')).toBe(null);
      expect(screen.queryByTestId('content-1')).toBe(null);
      expect(trigger1).toHaveAttribute('aria-expanded', 'false');
    });

    describe('inline nested viewport', () => {
      it('renders viewport content correctly for inline nested menu', async () => {
        await render(<TestInlineNestedNavigationMenu />);
        const trigger1 = screen.getByTestId('trigger-1');

        fireEvent.mouseEnter(trigger1);
        fireEvent.mouseMove(trigger1);
        clock.tick(OPEN_DELAY);
        await flushMicrotasks();

        const popup1 = screen.getByTestId('popup-1');
        expect(popup1).not.toBe(null);

        const nestedTrigger1 = within(popup1).getByTestId('nested-trigger-1');
        expect(nestedTrigger1).toHaveAttribute('aria-expanded', 'true');

        const nestedPopup1 = screen.getByTestId('nested-popup-1');
        expect(nestedPopup1).not.toBe(null);
        expect(screen.getByText('Nested Link 1')).not.toBe(null);
      });

      it('switches content in viewport when hovering different nested triggers', async () => {
        await render(<TestInlineNestedNavigationMenu />);
        const trigger1 = screen.getByTestId('trigger-1');

        fireEvent.mouseEnter(trigger1);
        fireEvent.mouseMove(trigger1);
        clock.tick(OPEN_DELAY);
        await flushMicrotasks();

        const popup1 = screen.getByTestId('popup-1');
        const nestedTrigger1 = within(popup1).getByTestId('nested-trigger-1');
        const nestedTrigger2 = within(popup1).getByTestId('nested-trigger-2');

        expect(nestedTrigger1).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByTestId('nested-popup-1')).not.toBe(null);

        fireEvent.mouseEnter(nestedTrigger2);
        fireEvent.mouseMove(nestedTrigger2);
        clock.tick(OPEN_DELAY);
        await flushMicrotasks();

        expect(nestedTrigger2).toHaveAttribute('aria-expanded', 'true');
        expect(nestedTrigger1).toHaveAttribute('aria-expanded', 'false');
        expect(screen.getByTestId('nested-popup-2')).not.toBe(null);
        expect(screen.queryByTestId('nested-popup-1')).toBe(null);

        fireEvent.mouseEnter(nestedTrigger1);
        fireEvent.mouseMove(nestedTrigger1);
        clock.tick(OPEN_DELAY);
        await flushMicrotasks();

        expect(nestedTrigger1).toHaveAttribute('aria-expanded', 'true');
        expect(nestedTrigger2).toHaveAttribute('aria-expanded', 'false');
        expect(screen.getByTestId('nested-popup-1')).not.toBe(null);
        expect(screen.queryByTestId('nested-popup-2')).toBe(null);
      });

      it('scopes inline safePolygon pointer events to the submenu list while traversing to the viewport', async () => {
        await render(<TestInlineNestedNavigationMenu />);
        const trigger1 = screen.getByTestId('trigger-1');

        fireEvent.mouseEnter(trigger1);
        fireEvent.mouseMove(trigger1);
        clock.tick(OPEN_DELAY);
        await flushMicrotasks();

        const nestedList = screen.getByTestId('inline-nested-list');
        const nestedTrigger1 = screen.getByTestId('nested-trigger-1');
        const nestedViewport = screen.getByTestId('inline-nested-viewport');

        mockBoundingClientRect(nestedTrigger1, { x: 0, y: 40, width: 100, height: 40 });
        mockBoundingClientRect(nestedViewport, { x: 200, y: 0, width: 300, height: 300 });
        fireEvent.mouseEnter(nestedTrigger1);

        expect(nestedList.style.pointerEvents).toBe('none');

        fireEvent.mouseLeave(nestedTrigger1, {
          clientX: 98,
          clientY: 60,
        });

        expect(nestedList.style.pointerEvents).toBe('none');
        expect(document.body.style.pointerEvents).toBe('');

        fireEvent.mouseMove(document, { clientX: 150, clientY: 80 });
        await flushMicrotasks();

        expect(nestedTrigger1).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByTestId('nested-popup-1')).not.toBe(null);
        expect(nestedList.style.pointerEvents).toBe('none');

        fireEvent.mouseEnter(nestedViewport);
        await flushMicrotasks();

        expect(nestedList.style.pointerEvents).toBe('');
      });

      it('clears inline safePolygon pointer events when the pointer leaves the traversal path', async () => {
        await render(<TestInlineNestedNavigationMenu />);
        const trigger1 = screen.getByTestId('trigger-1');

        fireEvent.mouseEnter(trigger1);
        fireEvent.mouseMove(trigger1);
        clock.tick(OPEN_DELAY);
        await flushMicrotasks();

        const nestedList = screen.getByTestId('inline-nested-list');
        const nestedTrigger1 = screen.getByTestId('nested-trigger-1');
        const nestedViewport = screen.getByTestId('inline-nested-viewport');

        mockBoundingClientRect(nestedTrigger1, { x: 0, y: 40, width: 100, height: 40 });
        mockBoundingClientRect(nestedViewport, { x: 200, y: 0, width: 300, height: 300 });
        fireEvent.mouseEnter(nestedTrigger1);

        expect(nestedList.style.pointerEvents).toBe('none');

        fireEvent.mouseLeave(nestedTrigger1, {
          clientX: 98,
          clientY: 60,
        });
        expect(nestedList.style.pointerEvents).toBe('none');

        fireEvent.mouseMove(document, { clientX: 40, clientY: 220 });
        await flushMicrotasks();

        expect(nestedList.style.pointerEvents).toBe('');
        expect(nestedTrigger1).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByTestId('nested-popup-1')).not.toBe(null);
      });

      it('keeps inline safePolygon pointer events when returning to the original trigger before traversing again', async () => {
        await render(<TestInlineNestedNavigationMenu />);
        const trigger1 = screen.getByTestId('trigger-1');

        fireEvent.mouseEnter(trigger1);
        fireEvent.mouseMove(trigger1);
        clock.tick(OPEN_DELAY);
        await flushMicrotasks();

        const nestedList = screen.getByTestId('inline-nested-list');
        const nestedTrigger1 = screen.getByTestId('nested-trigger-1');
        const nestedTrigger2 = screen.getByTestId('nested-trigger-2');
        const nestedViewport = screen.getByTestId('inline-nested-viewport');

        mockBoundingClientRect(nestedTrigger1, { x: 0, y: 40, width: 100, height: 40 });
        mockBoundingClientRect(nestedTrigger2, { x: 0, y: 100, width: 100, height: 40 });
        mockBoundingClientRect(nestedViewport, { x: 200, y: 0, width: 300, height: 300 });

        fireEvent.mouseEnter(nestedTrigger1);
        fireEvent.mouseLeave(nestedTrigger1, {
          clientX: 98,
          clientY: 60,
        });
        fireEvent.mouseMove(document, { clientX: 150, clientY: 80 });
        await flushMicrotasks();
        fireEvent.mouseEnter(nestedViewport);
        await flushMicrotasks();

        fireEvent.mouseEnter(nestedTrigger2);
        fireEvent.mouseMove(nestedTrigger2);
        clock.tick(OPEN_DELAY);
        await flushMicrotasks();

        fireEvent.mouseEnter(nestedTrigger1);
        fireEvent.mouseMove(nestedTrigger1);
        clock.tick(OPEN_DELAY);
        await flushMicrotasks();

        expect(nestedList.style.pointerEvents).toBe('none');

        fireEvent.mouseLeave(nestedTrigger1, {
          clientX: 98,
          clientY: 60,
        });
        fireEvent.mouseMove(document, { clientX: 150, clientY: 80 });
        await flushMicrotasks();

        expect(nestedList.style.pointerEvents).toBe('none');
        expect(nestedTrigger1).toHaveAttribute('aria-expanded', 'true');
        expect(nestedTrigger2).toHaveAttribute('aria-expanded', 'false');
        expect(screen.getByTestId('nested-popup-1')).not.toBe(null);
        expect(screen.queryByTestId('nested-popup-2')).toBe(null);
      });

      it('closes inline nested viewport when parent menu closes', async () => {
        await render(<TestInlineNestedNavigationMenu />);
        const trigger1 = screen.getByTestId('trigger-1');

        fireEvent.mouseEnter(trigger1);
        fireEvent.mouseMove(trigger1);
        clock.tick(OPEN_DELAY);
        await flushMicrotasks();

        const popup1 = screen.getByTestId('popup-1');
        expect(popup1).not.toBe(null);

        const nestedTrigger1 = within(popup1).getByTestId('nested-trigger-1');
        expect(nestedTrigger1).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByTestId('nested-popup-1')).not.toBe(null);

        fireEvent.mouseLeave(trigger1);
        fireEvent.mouseLeave(popup1);
        clock.tick(50); // closeDelay
        await flushMicrotasks();

        expect(screen.queryByTestId('popup-1')).toBe(null);
        expect(screen.queryByTestId('nested-popup-1')).toBe(null);
        expect(trigger1).toHaveAttribute('aria-expanded', 'false');
      });

      it('maintains inline viewport state when hovering between triggers and content', async () => {
        await render(<TestInlineNestedNavigationMenu />);
        const trigger1 = screen.getByTestId('trigger-1');

        fireEvent.mouseEnter(trigger1);
        fireEvent.mouseMove(trigger1);
        clock.tick(OPEN_DELAY);
        await flushMicrotasks();

        const popup1 = screen.getByTestId('popup-1');

        const nestedTrigger2 = within(popup1).getByTestId('nested-trigger-2');
        fireEvent.mouseEnter(nestedTrigger2);
        fireEvent.mouseMove(nestedTrigger2);
        clock.tick(OPEN_DELAY);
        await flushMicrotasks();

        expect(nestedTrigger2).toHaveAttribute('aria-expanded', 'true');
        const nestedPopup2 = screen.getByTestId('nested-popup-2');
        expect(nestedPopup2).not.toBe(null);

        fireEvent.mouseEnter(nestedPopup2);
        fireEvent.mouseMove(nestedPopup2);
        await flushMicrotasks();

        expect(nestedTrigger2).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByTestId('nested-popup-2')).not.toBe(null);

        fireEvent.mouseEnter(nestedTrigger2);
        fireEvent.mouseMove(nestedTrigger2);
        await flushMicrotasks();

        expect(nestedTrigger2).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByTestId('nested-popup-2')).not.toBe(null);
      });

      it('handles click interactions on inline nested menu triggers', async () => {
        await render(<TestInlineNestedNavigationMenu />);
        const trigger1 = screen.getByTestId('trigger-1');

        fireEvent.click(trigger1);
        await flushMicrotasks();

        const popup1 = screen.getByTestId('popup-1');
        expect(popup1).not.toBe(null);

        const nestedTrigger1 = within(popup1).getByTestId('nested-trigger-1');
        expect(nestedTrigger1).toHaveAttribute('aria-expanded', 'true');

        const nestedTrigger2 = within(popup1).getByTestId('nested-trigger-2');
        fireEvent.click(nestedTrigger2);
        await flushMicrotasks();

        expect(nestedTrigger2).toHaveAttribute('aria-expanded', 'true');
        expect(nestedTrigger1).toHaveAttribute('aria-expanded', 'false');
        expect(screen.getByTestId('nested-popup-2')).not.toBe(null);
        expect(screen.queryByTestId('nested-popup-1')).toBe(null);

        fireEvent.click(nestedTrigger2);
        await flushMicrotasks();

        expect(nestedTrigger2).toHaveAttribute('aria-expanded', 'true');
        expect(nestedTrigger1).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByTestId('nested-popup-2')).not.toBe(null);
        expect(screen.queryByTestId('nested-popup-1')).toBe(null);
      });

      it('adds popup-open data attributes to the active icon', async () => {
        await render(
          <NavigationMenu.Root defaultValue="item-1">
            <NavigationMenu.List>
              <NavigationMenu.Item value="item-1">
                <NavigationMenu.Trigger>
                  Item 1
                  <NavigationMenu.Icon data-testid="icon-1" />
                </NavigationMenu.Trigger>
                <NavigationMenu.Content>
                  <NavigationMenu.Link href="#link-1">Link 1</NavigationMenu.Link>
                </NavigationMenu.Content>
              </NavigationMenu.Item>
              <NavigationMenu.Item value="item-2">
                <NavigationMenu.Trigger>
                  Item 2
                  <NavigationMenu.Icon data-testid="icon-2" />
                </NavigationMenu.Trigger>
                <NavigationMenu.Content>
                  <NavigationMenu.Link href="#link-2">Link 2</NavigationMenu.Link>
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
          </NavigationMenu.Root>,
        );

        expect(screen.getByTestId('icon-1')).toHaveAttribute('data-popup-open');
        expect(screen.getByTestId('icon-2')).not.toHaveAttribute('data-popup-open');
      });

      it.each(falsyNavigationMenuValueCases)(
        'treats a falsy value (%s) as open for inline nested trigger interactions',
        async (_label, itemValue) => {
          await render(
            <TestInlineNestedNavigationMenu
              nestedDefaultValue={itemValue}
              nestedItem1Value={itemValue}
            />,
          );
          const trigger1 = screen.getByTestId('trigger-1');

          fireEvent.click(trigger1);
          await flushMicrotasks();

          const popup1 = screen.getByTestId('popup-1');
          const nestedTrigger1 = within(popup1).getByTestId('nested-trigger-1');
          expect(nestedTrigger1).toHaveAttribute('aria-expanded', 'true');
          expect(screen.queryByTestId('nested-popup-1')).not.toBe(null);

          fireEvent.click(nestedTrigger1);
          await flushMicrotasks();

          expect(nestedTrigger1).toHaveAttribute('aria-expanded', 'true');
          expect(screen.queryByTestId('nested-popup-1')).not.toBe(null);
        },
      );

      it('propagates a nested close with a falsy open value to the parent root', async () => {
        await render(
          <TestInlineNestedNavigationMenu
            nestedDefaultValue={false}
            nestedItem1Value={false}
            nestedLinkCloseOnClick
          />,
        );
        const trigger1 = screen.getByTestId('trigger-1');

        fireEvent.click(trigger1);
        await flushMicrotasks();

        const popup1 = screen.getByTestId('popup-1');
        const nestedTrigger1 = within(popup1).getByTestId('nested-trigger-1');
        expect(nestedTrigger1).toHaveAttribute('aria-expanded', 'true');

        fireEvent.click(screen.getByText('Nested Link 1'));
        await flushMicrotasks();

        expect(trigger1).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByTestId('popup-1')).toBe(null);
      });

      it('allows arrow key navigation to submenu triggers', async () => {
        const { user } = await render(<TestInlineNestedNavigationMenu />);
        const trigger1 = screen.getByTestId('trigger-1');

        fireEvent.click(trigger1);
        await flushMicrotasks();

        const popup1 = screen.getByTestId('popup-1');
        expect(popup1).not.toBe(null);

        const link1 = screen.getByText('Link 1');
        await act(async () => link1.focus());

        // Arrow down should move to nested-trigger-1
        await user.keyboard('{ArrowDown}');

        const nestedTrigger1 = within(popup1).getByTestId('nested-trigger-1');
        expect(nestedTrigger1).toHaveFocus();

        // Arrow down should move to nested-trigger-2
        await user.keyboard('{ArrowDown}');

        const nestedTrigger2 = within(popup1).getByTestId('nested-trigger-2');
        expect(nestedTrigger2).toHaveFocus();

        // Arrow up should move back to nested-trigger-1
        await user.keyboard('{ArrowUp}');
        expect(nestedTrigger1).toHaveFocus();

        // Arrow up should move back to Link 1
        await user.keyboard('{ArrowUp}');
        expect(link1).toHaveFocus();
      });

      it('allows arrow key navigation with 3+ levels of nesting', async () => {
        const { user } = await render(<TestDeeplyNestedNavigationMenu />);
        const trigger1 = screen.getByTestId('trigger-1');

        fireEvent.click(trigger1);
        await flushMicrotasks();

        const content1 = screen.getByTestId('content-1');
        expect(content1).not.toBe(null);

        // Level 1 content contains: Link 1, Level2-trigger-1, Level2-trigger-2
        const link1 = screen.getByTestId('link-1');
        await act(async () => link1.focus());

        // Navigate through Level 1 content items
        await user.keyboard('{ArrowDown}');
        const level2Trigger1 = screen.getByTestId('level2-trigger-1');
        expect(level2Trigger1).toHaveFocus();

        await user.keyboard('{ArrowDown}');
        const level2Trigger2 = screen.getByTestId('level2-trigger-2');
        expect(level2Trigger2).toHaveFocus();

        await user.keyboard('{ArrowUp}');
        expect(level2Trigger1).toHaveFocus();

        await user.keyboard('{ArrowUp}');
        expect(link1).toHaveFocus();

        // Now navigate into Level 2 content (which contains Level 3 triggers)
        const level2Content1 = screen.getByTestId('level2-content-1');
        const level2Link1 = within(level2Content1).getByTestId('level2-link-1');
        await act(async () => level2Link1.focus());

        // Navigate through Level 2 content items (includes Level 3 triggers)
        await user.keyboard('{ArrowDown}');
        const level3Trigger1 = screen.getByTestId('level3-trigger-1');
        expect(level3Trigger1).toHaveFocus();

        await user.keyboard('{ArrowDown}');
        const level3Trigger2 = screen.getByTestId('level3-trigger-2');
        expect(level3Trigger2).toHaveFocus();

        await user.keyboard('{ArrowUp}');
        expect(level3Trigger1).toHaveFocus();

        await user.keyboard('{ArrowUp}');
        expect(level2Link1).toHaveFocus();
      });

      it('updates popup sizing when inline nested content is inserted while active', async () => {
        const originalResizeObserver = globalThis.ResizeObserver;
        const previousAnimationsDisabled = globalThis.BASE_UI_ANIMATIONS_DISABLED;
        globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

        if (typeof originalResizeObserver === 'function') {
          globalThis.ResizeObserver = undefined as unknown as typeof ResizeObserver;
        }

        try {
          await render(<TestInlineNestedNavigationMenuWithDynamicContent />);
          const trigger1 = screen.getByTestId('trigger-1');

          fireEvent.click(trigger1);
          await flushMicrotasks();

          const popupRoot = screen.getByTestId('popup-root');
          const positioner = screen.getByTestId('positioner');
          const animations = mockAnimations(popupRoot);

          const popupWidth = 250;
          let popupHeight = 120;

          Object.defineProperty(popupRoot, 'offsetWidth', {
            configurable: true,
            get: () => popupWidth,
          });
          Object.defineProperty(popupRoot, 'offsetHeight', {
            configurable: true,
            get: () => popupHeight,
          });

          popupHeight = 220;
          animations.start();
          fireEvent.click(screen.getByTestId('insert-content'));
          await flushMicrotasks();

          expect(screen.getByTestId('extra-content')).not.toBe(null);
          await waitFor(() => {
            expect(
              parseInt(getComputedStyle(positioner).getPropertyValue('--positioner-height'), 10),
            ).toBe(220);
          });

          await act(async () => {
            await animations.finish();
            await flushMicrotasks();
          });

          await waitFor(() => {
            expect(popupRoot.style.getPropertyValue('--popup-width')).toBe('auto');
            expect(popupRoot.style.getPropertyValue('--popup-height')).toBe('auto');
            expect(positioner.style.getPropertyValue('--positioner-width')).toBe('250px');
            expect(positioner.style.getPropertyValue('--positioner-height')).toBe('220px');
          });
        } finally {
          globalThis.BASE_UI_ANIMATIONS_DISABLED = previousAnimationsDisabled;
          if (typeof originalResizeObserver === 'function') {
            globalThis.ResizeObserver = originalResizeObserver;
          }
        }
      });

      it('does not animate popup sizing when nested default content mounts during opening', async () => {
        const previousAnimationsDisabled = globalThis.BASE_UI_ANIMATIONS_DISABLED;
        globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

        try {
          await render(<TestInlineNestedNavigationMenu />);
          const trigger1 = screen.getByTestId('trigger-1');

          fireEvent.click(trigger1);

          const popupRoot = screen.getByTestId('popup-root');
          const positioner = screen.getByTestId('positioner');

          const popupHeightValues = [120, 220];
          const popupWidth = 250;
          let popupHeight = 220;

          Object.defineProperty(popupRoot, 'offsetWidth', {
            configurable: true,
            get: () => popupWidth,
          });
          Object.defineProperty(popupRoot, 'offsetHeight', {
            configurable: true,
            get: () => {
              const nextHeight = popupHeightValues.shift();
              if (nextHeight != null) {
                popupHeight = nextHeight;
              }

              return popupHeight;
            },
          });

          await flushMicrotasks();

          expect(screen.getByTestId('nested-popup-1')).not.toBe(null);
          await waitFor(() => {
            expect(popupRoot.style.getPropertyValue('--popup-width')).toBe('auto');
            expect(popupRoot.style.getPropertyValue('--popup-height')).toBe('auto');
            expect(positioner.style.getPropertyValue('--positioner-width')).toBe('250px');
            expect(positioner.style.getPropertyValue('--positioner-height')).toBe('220px');
          });
        } finally {
          globalThis.BASE_UI_ANIMATIONS_DISABLED = previousAnimationsDisabled;
        }
      });

      it('does not animate popup sizing when kept nested default content first moves into the portal', async () => {
        const previousAnimationsDisabled = globalThis.BASE_UI_ANIMATIONS_DISABLED;
        globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

        let setPopupPropertySpy: ReturnType<typeof vi.spyOn> | undefined;

        try {
          await render(<TestInlineNestedNavigationMenu keepMountedContent />);
          const trigger1 = screen.getByTestId('trigger-1');

          fireEvent.click(trigger1);

          const popupRoot = screen.getByTestId('popup-root');
          const positioner = screen.getByTestId('positioner');

          setPopupPropertySpy = vi.spyOn(popupRoot.style, 'setProperty');

          const popupHeightValues = [120, 220];
          const popupWidth = 250;
          let popupHeight = 220;

          Object.defineProperty(popupRoot, 'offsetWidth', {
            configurable: true,
            get: () => popupWidth,
          });
          Object.defineProperty(popupRoot, 'offsetHeight', {
            configurable: true,
            get: () => {
              const nextHeight = popupHeightValues.shift();
              if (nextHeight != null) {
                popupHeight = nextHeight;
              }

              return popupHeight;
            },
          });

          await flushMicrotasks();

          expect(screen.getByTestId('nested-popup-1')).not.toHaveAttribute('hidden');
          await waitFor(() => {
            expect(popupRoot.style.getPropertyValue('--popup-width')).toBe('auto');
            expect(popupRoot.style.getPropertyValue('--popup-height')).toBe('auto');
            expect(positioner.style.getPropertyValue('--positioner-width')).toBe('250px');
            expect(positioner.style.getPropertyValue('--positioner-height')).toBe('220px');
          });

          const popupSetPropertyCalls = setPopupPropertySpy.mock.calls as Array<
            [property: string, value: string, priority?: string]
          >;
          const fixedPopupHeightCalls = popupSetPropertyCalls
            .filter((call) => call[0] === '--popup-height')
            .map((call) => call[1])
            .filter((value) => value !== 'auto' && value !== '0px');

          expect(fixedPopupHeightCalls.length).toBeGreaterThan(0);
          expect(fixedPopupHeightCalls.every((value) => value === '220px')).toBe(true);
        } finally {
          setPopupPropertySpy?.mockRestore();
          globalThis.BASE_UI_ANIMATIONS_DISABLED = previousAnimationsDisabled;
        }
      });

      it('updates popup sizing when switching kept inline nested content', async () => {
        const restoreResizeObserver = mockResizeObserver();
        const previousAnimationsDisabled = globalThis.BASE_UI_ANIMATIONS_DISABLED;
        globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

        try {
          await render(<TestInlineNestedNavigationMenu keepMountedContent />);
          const trigger1 = screen.getByTestId('trigger-1');

          fireEvent.click(trigger1);
          await flushMicrotasks();

          const popupRoot = screen.getByTestId('popup-root');
          const positioner = screen.getByTestId('positioner');
          const animations = mockAnimations(popupRoot);

          const popupWidth = 250;
          let popupHeight = 220;

          Object.defineProperty(popupRoot, 'offsetWidth', {
            configurable: true,
            get: () => popupWidth,
          });
          Object.defineProperty(popupRoot, 'offsetHeight', {
            configurable: true,
            get: () => popupHeight,
          });

          primeOpenPopupSize(popupRoot, positioner, 250, 220);

          popupHeight = 300;
          animations.start();
          fireEvent.click(screen.getByTestId('nested-trigger-2'));
          await flushMicrotasks();

          expect(screen.getByTestId('nested-popup-2')).not.toHaveAttribute('hidden');
          await waitFor(() => {
            expect(screen.getByTestId('nested-popup-1')).toHaveAttribute('hidden');
          });
          await waitFor(() => {
            expect(
              parseInt(getComputedStyle(positioner).getPropertyValue('--positioner-height'), 10),
            ).toBe(300);
          });

          await act(async () => {
            await animations.finish();
            await flushMicrotasks();
          });

          await waitFor(() => {
            expect(popupRoot.style.getPropertyValue('--popup-width')).toBe('auto');
            expect(popupRoot.style.getPropertyValue('--popup-height')).toBe('auto');
            expect(positioner.style.getPropertyValue('--positioner-width')).toBe('250px');
            expect(positioner.style.getPropertyValue('--positioner-height')).toBe('300px');
          });
        } finally {
          globalThis.BASE_UI_ANIMATIONS_DISABLED = previousAnimationsDisabled;
          restoreResizeObserver();
        }
      });

      it('updates popup sizing when a kept nested content hidden attribute changes', async () => {
        const restoreResizeObserver = mockResizeObserver();
        const previousAnimationsDisabled = globalThis.BASE_UI_ANIMATIONS_DISABLED;
        globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

        try {
          await render(<TestInlineNestedNavigationMenu keepMountedContent />);
          const trigger1 = screen.getByTestId('trigger-1');

          fireEvent.click(trigger1);
          await flushMicrotasks();

          const popupRoot = screen.getByTestId('popup-root');
          const positioner = screen.getByTestId('positioner');

          const popupWidth = 250;
          let popupHeight = 220;

          Object.defineProperty(popupRoot, 'offsetWidth', {
            configurable: true,
            get: () => popupWidth,
          });
          Object.defineProperty(popupRoot, 'offsetHeight', {
            configurable: true,
            get: () => popupHeight,
          });

          primeOpenPopupSize(popupRoot, positioner, 250, 220);

          popupHeight = 300;

          await act(async () => {
            // Contract-level check for the MutationObserver path; the sibling
            // switch test above covers the React-driven `hidden` toggle.
            screen.getByTestId('nested-popup-1').setAttribute('hidden', '');
            await flushMicrotasks();
          });

          await waitFor(() => {
            expect(positioner.style.getPropertyValue('--positioner-width')).toBe('250px');
            expect(positioner.style.getPropertyValue('--positioner-height')).toBe('300px');
          });
        } finally {
          globalThis.BASE_UI_ANIMATIONS_DISABLED = previousAnimationsDisabled;
          restoreResizeObserver();
        }
      });

      it('keeps inline mutation resize interruptible when content updates again mid-transition', async () => {
        const previousAnimationsDisabled = globalThis.BASE_UI_ANIMATIONS_DISABLED;
        globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

        try {
          await render(
            <TestInlineNestedNavigationMenuWithDynamicContent initialContentStage={1} />,
          );
          const trigger1 = screen.getByTestId('trigger-1');

          fireEvent.click(trigger1);
          await flushMicrotasks();

          const popupRoot = screen.getByTestId('popup-root');
          const positioner = screen.getByTestId('positioner');
          const animations = mockAnimations(popupRoot);

          const popupWidth = 250;
          const popupHeightValues = [190, 260];
          let popupHeight = 260;

          Object.defineProperty(popupRoot, 'offsetWidth', {
            configurable: true,
            get: () => popupWidth,
          });
          Object.defineProperty(popupRoot, 'offsetHeight', {
            configurable: true,
            get: () => {
              const nextHeight = popupHeightValues.shift();
              if (nextHeight != null) {
                popupHeight = nextHeight;
              }

              return popupHeight;
            },
          });

          popupRoot.style.setProperty('--popup-width', '250px');
          popupRoot.style.setProperty('--popup-height', '220px');
          positioner.style.setProperty('--positioner-width', '250px');
          positioner.style.setProperty('--positioner-height', '220px');

          const setPropertySpy = vi.spyOn(positioner.style, 'setProperty');

          animations.start();
          fireEvent.click(screen.getByTestId('insert-content'));
          await flushMicrotasks();

          expect(screen.getByTestId('extra-content-2')).not.toBe(null);
          expect(
            setPropertySpy.mock.calls.some(
              (call) => call[0] === '--positioner-height' && call[1] === '190px',
            ),
          ).toBe(true);

          await act(async () => {
            animations.finish();
            await flushMicrotasks();
          });

          await waitFor(() => {
            expect(positioner.style.getPropertyValue('--positioner-height')).toBe('260px');
            expect(popupRoot.style.getPropertyValue('--popup-height')).toBe('auto');
          });

          setPropertySpy.mockRestore();
        } finally {
          globalThis.BASE_UI_ANIMATIONS_DISABLED = previousAnimationsDisabled;
        }
      });

      it('updates popup sizing when the window is resized while the popup is open', async () => {
        const restoreResizeObserver = mockResizeObserver();

        try {
          await render(<TestNavigationMenuWithKeepMountedContent />);

          const popupRoot = screen.getByTestId('popup-root');
          const positioner = screen.getByTestId('positioner');

          let popupWidth = 675;
          let popupHeight = 220;

          Object.defineProperty(popupRoot, 'offsetWidth', {
            configurable: true,
            get: () => popupWidth,
          });
          Object.defineProperty(popupRoot, 'offsetHeight', {
            configurable: true,
            get: () => popupHeight,
          });

          popupRoot.style.setProperty('--popup-width', 'auto');
          popupRoot.style.setProperty('--popup-height', 'auto');
          positioner.style.setProperty('--positioner-width', '675px');
          positioner.style.setProperty('--positioner-height', '220px');

          popupWidth = 500;
          popupHeight = 180;

          fireEvent(window, new Event('resize'));
          expect(positioner).toHaveAttribute('data-instant');

          clock.tick(0);
          await flushMicrotasks();
          expect(positioner).toHaveAttribute('data-instant');

          clock.tick(100);
          await flushMicrotasks();
          expect(positioner).not.toHaveAttribute('data-instant');

          await waitFor(() => {
            expect(popupRoot.style.getPropertyValue('--popup-width')).toBe('auto');
            expect(popupRoot.style.getPropertyValue('--popup-height')).toBe('auto');
            expect(positioner.style.getPropertyValue('--positioner-width')).toBe('500px');
            expect(positioner.style.getPropertyValue('--positioner-height')).toBe('180px');
          });
        } finally {
          restoreResizeObserver();
        }
      });

      it('updates popup sizing immediately when switching to a keepMounted trigger', async () => {
        const restoreResizeObserver = mockResizeObserver();
        const previousAnimationsDisabled = globalThis.BASE_UI_ANIMATIONS_DISABLED;
        globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

        try {
          await render(<TestNavigationMenuWithKeepMountedContent />);

          const popupRoot = screen.getByTestId('popup-root');
          const positioner = screen.getByTestId('positioner');
          const animations = mockAnimations(popupRoot);

          let popupWidth = 675;
          let popupHeight = 220;

          Object.defineProperty(popupRoot, 'offsetWidth', {
            configurable: true,
            get: () => popupWidth,
          });
          Object.defineProperty(popupRoot, 'offsetHeight', {
            configurable: true,
            get: () => popupHeight,
          });

          popupRoot.style.setProperty('--popup-width', 'auto');
          popupRoot.style.setProperty('--popup-height', 'auto');
          positioner.style.setProperty('--positioner-width', '675px');
          positioner.style.setProperty('--positioner-height', '220px');

          popupWidth = 500;
          popupHeight = 180;
          animations.start();
          fireEvent.click(screen.getByTestId('trigger-learn'));
          await flushMicrotasks();

          expect(positioner.style.getPropertyValue('--positioner-width')).toBe('500px');
          expect(positioner.style.getPropertyValue('--positioner-height')).toBe('180px');

          await act(async () => {
            animations.finish();
            await flushMicrotasks();
          });

          await waitFor(() => {
            expect(popupRoot.style.getPropertyValue('--popup-width')).toBe('auto');
            expect(popupRoot.style.getPropertyValue('--popup-height')).toBe('auto');
            expect(positioner.style.getPropertyValue('--positioner-width')).toBe('500px');
            expect(positioner.style.getPropertyValue('--positioner-height')).toBe('180px');
          });
        } finally {
          globalThis.BASE_UI_ANIMATIONS_DISABLED = previousAnimationsDisabled;
          restoreResizeObserver();
        }
      });

      it('ignores the initial open size reset once a trigger switch has started', async () => {
        const restoreResizeObserver = mockResizeObserver();
        const previousAnimationsDisabled = globalThis.BASE_UI_ANIMATIONS_DISABLED;
        globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

        try {
          function waitForAnimationFrame() {
            return new Promise<void>((resolve) => {
              requestAnimationFrame(() => {
                resolve();
              });
            });
          }

          await render(<TestNavigationMenuWithKeepMountedContentClosed />);

          const popupRoot = screen.getByTestId('popup-root');
          const positioner = screen.getByTestId('positioner');
          const animations = mockAnimations(popupRoot);

          async function waitForSettledAnimations() {
            await act(async () => {
              await flushMicrotasks();
              await waitForAnimationFrame();
              await waitForAnimationFrame();
            });
          }

          async function finishAnimation(animation: Parameters<typeof animations.finish>[0]) {
            await act(async () => {
              await animations.finish(animation);
              await flushMicrotasks();
              await waitForAnimationFrame();
              await waitForAnimationFrame();
            });
          }

          let popupWidth = 675;
          let popupHeight = 220;

          Object.defineProperty(popupRoot, 'offsetWidth', {
            configurable: true,
            get: () => popupWidth,
          });
          Object.defineProperty(popupRoot, 'offsetHeight', {
            configurable: true,
            get: () => popupHeight,
          });

          const openAnimation = animations.start();
          fireEvent.click(screen.getByTestId('trigger-product'));
          await waitForSettledAnimations();

          popupWidth = 500;
          popupHeight = 180;

          const switchAnimation = animations.start();
          fireEvent.click(screen.getByTestId('trigger-learn'));
          await waitForSettledAnimations();

          await waitFor(() => {
            expect(positioner.style.getPropertyValue('--positioner-width')).toBe('500px');
            expect(positioner.style.getPropertyValue('--positioner-height')).toBe('180px');
          });

          await finishAnimation(openAnimation);

          expect(popupRoot.style.getPropertyValue('--popup-width')).toBe('500px');
          expect(popupRoot.style.getPropertyValue('--popup-height')).toBe('180px');

          await finishAnimation(switchAnimation);

          await waitFor(() => {
            expect(popupRoot.style.getPropertyValue('--popup-width')).toBe('auto');
            expect(popupRoot.style.getPropertyValue('--popup-height')).toBe('auto');
          });
        } finally {
          globalThis.BASE_UI_ANIMATIONS_DISABLED = previousAnimationsDisabled;
          restoreResizeObserver();
        }
      });

      it('seeds the popup width from the exiting panel when reopening after hovering a top-level link', async () => {
        const previousAnimationsDisabled = globalThis.BASE_UI_ANIMATIONS_DISABLED;
        globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

        let popupWidthSpy: ReturnType<typeof vi.spyOn> | undefined;

        try {
          function waitForAnimationFrame() {
            return new Promise<void>((resolve) => {
              requestAnimationFrame(() => {
                resolve();
              });
            });
          }

          await render(<TestNavigationMenuWithTopLevelLinkScopedPopupAnimation />);

          const triggerProduct = screen.getByTestId('trigger-product');
          const triggerLearn = screen.getByTestId('trigger-learn');
          const topLevelLink = screen.getByTestId('top-level-link');
          const popupRoot = screen.getByTestId('popup-root');
          const positioner = screen.getByTestId('positioner');
          const animations = mockAnimations(popupRoot);

          let nextPanelWidth = 675;
          let nextPanelHeight = 220;

          Object.defineProperty(popupRoot, 'offsetWidth', {
            configurable: true,
            get: () => {
              const fixedWidth = popupRoot.style.getPropertyValue('--popup-width');
              return fixedWidth && fixedWidth !== 'auto'
                ? parseInt(fixedWidth, 10)
                : nextPanelWidth;
            },
          });
          Object.defineProperty(popupRoot, 'offsetHeight', {
            configurable: true,
            get: () => {
              const fixedHeight = popupRoot.style.getPropertyValue('--popup-height');
              return fixedHeight && fixedHeight !== 'auto'
                ? parseInt(fixedHeight, 10)
                : nextPanelHeight;
            },
          });

          const openAnimation = animations.start();
          fireEvent.mouseEnter(triggerProduct);
          fireEvent.mouseMove(triggerProduct);
          clock.tick(OPEN_DELAY);
          await flushMicrotasks();

          await act(async () => {
            await animations.finish(openAnimation);
            await flushMicrotasks();
          });

          await waitFor(() => {
            expect(triggerProduct).toHaveAttribute('aria-expanded', 'true');
            expect(popupRoot.style.getPropertyValue('--popup-width')).toBe('auto');
          });

          const productContent = screen
            .getByText('Product panel')
            .closest('.test-navigation-menu-content') as HTMLElement;
          const productContentAnimations = mockAnimations(productContent);
          const productContentCloseAnimation = productContentAnimations.start();

          const closeAnimation = animations.start();
          fireEvent.mouseLeave(triggerProduct, { relatedTarget: topLevelLink });
          fireEvent.mouseEnter(topLevelLink);
          fireEvent.mouseMove(topLevelLink);
          clock.tick(OPEN_DELAY);
          await flushMicrotasks();

          await waitFor(() => {
            expect(triggerProduct).toHaveAttribute('aria-expanded', 'false');
          });

          nextPanelWidth = 500;
          nextPanelHeight = 180;
          popupWidthSpy = vi.spyOn(popupRoot.style, 'setProperty');

          const reopenAnimation = animations.start();
          fireEvent.mouseEnter(triggerLearn);
          fireEvent.mouseMove(triggerLearn);
          clock.tick(OPEN_DELAY);
          await flushMicrotasks();

          await act(async () => {
            await waitForAnimationFrame();
            await flushMicrotasks();
          });

          const popupWidthCalls = (
            popupWidthSpy.mock.calls as Array<[property: string, value: string, priority?: string]>
          )
            .filter((call) => call[0] === '--popup-width')
            .map((call) => call[1]);
          const exitingWidthIndex = popupWidthCalls.indexOf('675px');
          const reopeningWidthIndex = popupWidthCalls.lastIndexOf('500px');

          expect(triggerLearn).toHaveAttribute('aria-expanded', 'true');
          expect(positioner.style.getPropertyValue('--positioner-width')).toBe('500px');
          expect(exitingWidthIndex).toBeGreaterThan(-1);
          expect(reopeningWidthIndex).toBeGreaterThan(exitingWidthIndex);

          await act(async () => {
            await productContentAnimations.finish(productContentCloseAnimation);
            await animations.finish(closeAnimation);
            await animations.finish(reopenAnimation);
            await flushMicrotasks();
          });
        } finally {
          popupWidthSpy?.mockRestore();
          globalThis.BASE_UI_ANIMATIONS_DISABLED = previousAnimationsDisabled;
        }
      });

      it.skipIf(isJSDOM)('closes on the short exit path after switching content', async () => {
        const animationsDisabled = globalThis.BASE_UI_ANIMATIONS_DISABLED;
        globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

        try {
          function waitForAnimationFrame() {
            return new Promise<void>((resolve) => {
              requestAnimationFrame(() => {
                resolve();
              });
            });
          }

          const onOpenChangeComplete = vi.fn();
          await render(
            <TestNavigationMenuWithScopedPopupExitAnimation
              onOpenChangeComplete={onOpenChangeComplete}
            />,
          );

          const triggerProduct = screen.getByTestId('trigger-product');
          const triggerLearn = screen.getByTestId('trigger-learn');

          fireEvent.click(triggerProduct);
          await flushMicrotasks();

          const productContent = screen
            .getByText('Product panel')
            .closest('.test-navigation-menu-content') as HTMLElement;
          const productContentAnimations = mockAnimations(productContent);
          const productContentCloseAnimation = productContentAnimations.start();

          fireEvent.click(triggerLearn);
          await flushMicrotasks();

          let popupRoot: HTMLElement | null = null;

          await waitFor(() => {
            popupRoot = screen.getByTestId('popup-root');
            expect(triggerProduct).toHaveAttribute('aria-expanded', 'false');
            expect(triggerLearn).toHaveAttribute('aria-expanded', 'true');
          });

          await act(async () => {
            await waitForAnimationFrame();
            await flushMicrotasks();
            await productContentAnimations.finish(productContentCloseAnimation);
            await flushMicrotasks();
          });

          await waitFor(() => {
            const hasRunningAnimations = popupRoot!
              .getAnimations()
              .some((animation) => animation.playState !== 'finished');
            expect(hasRunningAnimations).toBe(false);
          });

          await act(async () => triggerLearn.focus());

          const closeStart = performance.now();
          fireEvent.keyDown(triggerLearn, { key: 'Escape' });
          await flushMicrotasks();

          await waitFor(() => {
            expect(onOpenChangeComplete.mock.calls.length).toBe(1);
            expect(onOpenChangeComplete.mock.calls[0][0]).toBe(false);
          });

          expect(performance.now() - closeStart).toBeLessThan(325);
        } finally {
          globalThis.BASE_UI_ANIMATIONS_DISABLED = animationsDisabled;
        }
      });

      it('does not collapse auto-sized popup to zero on close if measurement temporarily returns 0', async () => {
        await render(<TestInlineNestedNavigationMenuWithDynamicContent />);
        const trigger1 = screen.getByTestId('trigger-1');

        fireEvent.click(trigger1);
        await flushMicrotasks();

        const popupRoot = screen.getByTestId('popup-root');
        const positioner = screen.getByTestId('positioner');

        primeOpenPopupSize(popupRoot, positioner, 250, 120);

        Object.defineProperty(popupRoot, 'offsetWidth', {
          configurable: true,
          get: () => (screen.queryByTestId('popup-1')?.hasAttribute('data-open') ? 250 : 0),
        });
        Object.defineProperty(popupRoot, 'offsetHeight', {
          configurable: true,
          get: () => (screen.queryByTestId('popup-1')?.hasAttribute('data-open') ? 120 : 0),
        });
        Object.defineProperty(positioner, 'offsetWidth', {
          configurable: true,
          get: () => 0,
        });
        Object.defineProperty(positioner, 'offsetHeight', {
          configurable: true,
          get: () => 0,
        });

        fireEvent.blur(trigger1, { relatedTarget: document.body });
        await flushMicrotasks();

        expect(popupRoot.style.getPropertyValue('--popup-width')).toBe('250px');
        expect(popupRoot.style.getPropertyValue('--popup-height')).toBe('120px');
        expect(positioner.style.getPropertyValue('--positioner-width')).toBe('250px');
        expect(positioner.style.getPropertyValue('--positioner-height')).toBe('120px');
      });

      it('tabs from the last link of the last nested panel to the next top-level trigger', async () => {
        const { user } = await render(<TestInlineNestedNavigationMenuTabForwardBoundary />);
        const trigger1 = screen.getByTestId('trigger-1');

        await user.click(trigger1);
        await flushMicrotasks();

        const nestedLastLink = screen.getByTestId('nested-last-link');
        await act(async () => nestedLastLink.focus());
        expect(nestedLastLink).toHaveFocus();

        await user.tab();

        expect(screen.getByTestId('trigger-2')).toHaveFocus();
        expect(screen.getByTestId('nested-popup-2')).not.toBe(null);
        expect(screen.getByTestId('nested-trigger-2')).toHaveAttribute('aria-expanded', 'true');
      });

      it('tabs between nested triggers and links without opening inactive panels', async () => {
        const { user } = await render(<TestInlineNestedNavigationMenuTabFlow />);
        const triggerProduct = screen.getByTestId('trigger-product');

        await user.click(triggerProduct);
        await flushMicrotasks();

        const nestedDevelopersTrigger = screen.getByTestId('nested-trigger-developers');
        await act(async () => nestedDevelopersTrigger.focus());
        expect(nestedDevelopersTrigger).toHaveFocus();

        await user.tab();
        expect(screen.getByTestId('nested-link-get-started')).toHaveFocus();

        await user.tab({ shift: true });
        expect(nestedDevelopersTrigger).toHaveFocus();

        await user.tab();
        expect(screen.getByTestId('nested-link-get-started')).toHaveFocus();

        await user.tab();
        expect(screen.getByTestId('nested-link-composition')).toHaveFocus();

        await user.tab();
        expect(screen.getByTestId('nested-trigger-design-systems')).toHaveFocus();
        expect(screen.queryByTestId('nested-popup-design-systems')).toBe(null);

        await user.tab();
        expect(screen.getByText('Engineering Leads')).toHaveFocus();
      });

      it('returns to the last inline submenu item when shift+tabbing after leaving it', async () => {
        const { user } = await render(<TestInlineNestedNavigationMenuTabFlow />);
        const triggerProduct = screen.getByTestId('trigger-product');

        await user.click(triggerProduct);
        await flushMicrotasks();

        await user.tab();
        expect(screen.getByTestId('nested-trigger-developers')).toHaveFocus();

        await user.tab();
        expect(screen.getByTestId('nested-link-get-started')).toHaveFocus();

        await user.tab();
        expect(screen.getByTestId('nested-link-composition')).toHaveFocus();

        await user.tab();
        expect(screen.getByTestId('nested-trigger-design-systems')).toHaveFocus();

        await user.tab({ shift: true });
        expect(screen.getByTestId('nested-link-composition')).toHaveFocus();
      });
    });
  });
});

describe('initial open', () => {
  // A dedicated renderer without `shouldAdvanceTime` so the one-frame instant reset
  // (scheduled via a zero-delay timeout) can be observed deterministically rather
  // than racing the assertion.
  const { render, clock } = createRenderer();

  clock.withFakeTimers();

  it('suppresses the positioner transition for the first frame while initially open', async () => {
    await render(<TestNavigationMenu defaultValue="item-1" />);

    // While initially open, the positioner starts with its transition suppressed so a
    // default value does not animate in from the unpositioned portal state.
    const positioner = screen.getByTestId('top-level-positioner');
    expect(positioner).toHaveAttribute('data-instant');

    // The suppression is released on the next tick.
    clock.tick(0);
    await flushMicrotasks();
    expect(positioner).not.toHaveAttribute('data-instant');
  });
});
