import { expect, vi } from 'vitest';
import * as React from 'react';
import { Tabs } from '@base-ui/react/tabs';
import { waitFor, screen } from '@mui/internal-test-utils';
import { createRenderer, describeConformance, isJSDOM } from '#test-utils';
import { getCssDimensions } from '../../utils/getCssDimensions';

describe('<Tabs.Indicator />', () => {
  const { render, renderToString } = createRenderer();

  describeConformance(<Tabs.Indicator />, () => ({
    render: (node) => {
      return render(
        <Tabs.Root defaultValue={1}>
          <Tabs.List>
            <Tabs.Tab value={1} />
            {node}
          </Tabs.List>
        </Tabs.Root>,
      );
    },
    refInstanceof: window.HTMLSpanElement,
    testRenderPropWith: 'div',
  }));

  it('exposes null active tab state when the selected value has no matching tab', async () => {
    const indicatorStates: Tabs.Indicator.State[] = [];

    function renderIndicator(
      props: React.HTMLAttributes<HTMLSpanElement>,
      state: Tabs.Indicator.State,
    ) {
      indicatorStates.push(state);
      return <span data-testid="bubble" {...props} />;
    }

    await render(
      <Tabs.Root value="missing">
        <Tabs.List>
          <Tabs.Tab value="one">One</Tabs.Tab>
          <Tabs.Indicator render={renderIndicator} />
        </Tabs.List>
      </Tabs.Root>,
    );

    // Wait for Tabs.List to register its element; before that no tab can be measured.
    await waitFor(() => {
      expect(indicatorStates.length).toBeGreaterThan(1);
    });

    const state = indicatorStates.at(-1)!;
    expect(state.activeTabPosition).toBe(null);
    expect(state.activeTabSize).toBe(null);
    expect(screen.getByTestId('bubble')).toHaveAttribute('hidden');
  });

  describe.skipIf(isJSDOM)('rendering', () => {
    it('should not render when no tab is active', async () => {
      await render(
        <Tabs.Root value={null}>
          <Tabs.List>
            <Tabs.Indicator data-testid="bubble" />
          </Tabs.List>
        </Tabs.Root>,
      );

      expect(screen.queryByTestId('bubble')).toBe(null);
    });

    function assertSize(actual: string, expected: number) {
      const actualNumber = parseFloat(actual);
      expect(Math.abs(actualNumber - expected)).toBeLessThanOrEqual(0.01);
    }

    function assertBubblePositionVariables(
      bubble: HTMLElement,
      tabList: HTMLElement,
      activeTab: HTMLElement,
    ) {
      const tabRect = activeTab.getBoundingClientRect();
      const tabListRect = tabList.getBoundingClientRect();
      const { width: tabWidth, height: tabHeight } = getCssDimensions(activeTab);
      const { width: tabListWidth, height: tabListHeight } = getCssDimensions(tabList);
      const scaleX = tabListWidth > 0 ? tabListRect.width / tabListWidth : 1;
      const scaleY = tabListHeight > 0 ? tabListRect.height / tabListHeight : 1;

      const relativeLeft =
        (tabRect.left - tabListRect.left) / scaleX + tabList.scrollLeft - tabList.clientLeft;
      const relativeTop =
        (tabRect.top - tabListRect.top) / scaleY + tabList.scrollTop - tabList.clientTop;
      const relativeRight = tabList.scrollWidth - relativeLeft - tabWidth;
      const relativeBottom = tabList.scrollHeight - relativeTop - tabHeight;

      const bubbleComputedStyle = window.getComputedStyle(bubble);
      const actualLeft = bubbleComputedStyle.getPropertyValue('--active-tab-left');
      const actualRight = bubbleComputedStyle.getPropertyValue('--active-tab-right');
      const actualTop = bubbleComputedStyle.getPropertyValue('--active-tab-top');
      const actualBottom = bubbleComputedStyle.getPropertyValue('--active-tab-bottom');
      const actualWidth = bubbleComputedStyle.getPropertyValue('--active-tab-width');
      const actualHeight = bubbleComputedStyle.getPropertyValue('--active-tab-height');

      assertSize(actualLeft, relativeLeft);
      assertSize(actualRight, relativeRight);
      assertSize(actualTop, relativeTop);
      assertSize(actualBottom, relativeBottom);
      assertSize(actualWidth, tabWidth);
      assertSize(actualHeight, tabHeight);
    }

    it('should set CSS variables corresponding to the active tab', async () => {
      await render(
        <Tabs.Root value={2}>
          <Tabs.List>
            <Tabs.Tab value={1}>One</Tabs.Tab>
            <Tabs.Tab value={2}>Two</Tabs.Tab>
            <Tabs.Tab value={3}>Three</Tabs.Tab>
            <Tabs.Indicator data-testid="bubble" />
          </Tabs.List>
        </Tabs.Root>,
      );

      const bubble = screen.getByTestId('bubble');
      const tabs = screen.getAllByRole('tab');
      const activeTab = tabs[1];
      const tabList = screen.getByRole('tablist');

      await waitFor(() => {
        assertBubblePositionVariables(bubble, tabList, activeTab);
      });
    });

    it('should update the position and movement variables when the active tab changes', async () => {
      const { setProps } = await render(
        <Tabs.Root value={2}>
          <Tabs.List>
            <Tabs.Tab value={1}>One</Tabs.Tab>
            <Tabs.Tab value={2}>Two</Tabs.Tab>
            <Tabs.Tab value={3}>Three</Tabs.Tab>
            <Tabs.Indicator data-testid="bubble" />
          </Tabs.List>
        </Tabs.Root>,
      );

      await setProps({ value: 3 });

      const bubble = screen.getByTestId('bubble');
      const tabs = screen.getAllByRole('tab');
      let activeTab = tabs[2];
      const tabList = screen.getByRole('tablist');

      assertBubblePositionVariables(bubble, tabList, activeTab);

      await setProps({ value: 1 });
      activeTab = tabs[0];
      await waitFor(() => {
        assertBubblePositionVariables(bubble, tabList, activeTab);
      });
    });

    it('should update the position variables when the tab list is resized', async () => {
      const { setProps } = await render(
        <Tabs.Root value={1} style={{ width: '400px' }}>
          <Tabs.List style={{ display: 'flex' }}>
            <Tabs.Tab value={1} style={{ flex: '1 1 auto' }}>
              One
            </Tabs.Tab>
            <Tabs.Tab value={2} style={{ flex: '1 1 auto' }}>
              Two
            </Tabs.Tab>
            <Tabs.Indicator data-testid="bubble" />
          </Tabs.List>
        </Tabs.Root>,
      );

      const bubble = screen.getByTestId('bubble');
      const tabs = screen.getAllByRole('tab');
      const activeTab = tabs[0];
      const tabList = screen.getByRole('tablist');

      assertBubblePositionVariables(bubble, tabList, activeTab);

      await setProps({
        style: { width: '800px' },
      });

      await waitFor(() => {
        assertBubblePositionVariables(bubble, tabList, activeTab);
      });
    });

    it('should account for scroll and border when the tab list is transformed', async () => {
      await render(
        <div style={{ transform: 'scale(1.5)' }}>
          <Tabs.Root value={3}>
            <Tabs.List
              data-testid="tab-list"
              style={{
                width: '240px',
                display: 'flex',
                gap: '8px',
                overflowX: 'auto',
                border: '6px solid black',
                padding: '4px',
              }}
            >
              <Tabs.Tab value={1} style={{ flex: '0 0 120px' }}>
                One
              </Tabs.Tab>
              <Tabs.Tab value={2} style={{ flex: '0 0 120px' }}>
                Two
              </Tabs.Tab>
              <Tabs.Tab value={3} style={{ flex: '0 0 120px' }}>
                Three
              </Tabs.Tab>
              <Tabs.Tab value={4} style={{ flex: '0 0 120px' }}>
                Four
              </Tabs.Tab>
              <Tabs.Tab value={5} style={{ flex: '0 0 120px' }}>
                Five
              </Tabs.Tab>
              <Tabs.Indicator data-testid="bubble" />
            </Tabs.List>
          </Tabs.Root>
        </div>,
      );

      const bubble = screen.getByTestId('bubble');
      const tabList = screen.getByTestId('tab-list');
      const activeTab = screen.getAllByRole('tab')[2];

      tabList.scrollLeft = 80;

      await waitFor(() => {
        assertBubblePositionVariables(bubble, tabList, activeTab);
      });
    });

    it('updates position when a different tab resizes', async () => {
      await render(
        <Tabs.Root value={2}>
          <Tabs.List
            data-testid="tab-list"
            style={{ width: '300px', display: 'flex', overflow: 'hidden' }}
          >
            <Tabs.Tab data-testid="first-tab" value={1} style={{ width: '100px', flexShrink: 0 }}>
              One
            </Tabs.Tab>
            <Tabs.Tab value={2} style={{ width: '100px', flexShrink: 0 }}>
              Two
            </Tabs.Tab>
            <Tabs.Tab value={3} style={{ width: '100px', flexShrink: 0 }}>
              Three
            </Tabs.Tab>
            <Tabs.Indicator data-testid="bubble" />
          </Tabs.List>
        </Tabs.Root>,
      );

      const bubble = screen.getByTestId('bubble');
      const tabList = screen.getByTestId('tab-list');
      const firstTab = screen.getByTestId('first-tab');
      const activeTab = screen.getAllByRole('tab')[1];

      await waitFor(() => {
        assertBubblePositionVariables(bubble, tabList, activeTab);
      });

      firstTab.setAttribute('style', 'width: 140px; flex-shrink: 0;');

      await waitFor(() => {
        assertBubblePositionVariables(bubble, tabList, activeTab);
      });
    });

    it('updates position when a new tab is inserted and then resized', async () => {
      function TestTabs({ insertedTabWidth }: { insertedTabWidth: number | null }) {
        return (
          <Tabs.Root value={2}>
            <Tabs.List
              data-testid="tab-list"
              style={{ width: '320px', display: 'flex', overflow: 'hidden' }}
            >
              {insertedTabWidth != null && (
                <Tabs.Tab
                  data-testid="inserted-tab"
                  value={0}
                  style={{ width: `${insertedTabWidth}px`, flexShrink: 0 }}
                >
                  Inserted
                </Tabs.Tab>
              )}
              <Tabs.Tab value={1} style={{ width: '100px', flexShrink: 0 }}>
                One
              </Tabs.Tab>
              <Tabs.Tab value={2} style={{ width: '100px', flexShrink: 0 }}>
                Two
              </Tabs.Tab>
              <Tabs.Tab value={3} style={{ width: '100px', flexShrink: 0 }}>
                Three
              </Tabs.Tab>
              <Tabs.Indicator data-testid="bubble" />
            </Tabs.List>
          </Tabs.Root>
        );
      }

      const { setProps } = await render(<TestTabs insertedTabWidth={null} />);

      const bubble = screen.getByTestId('bubble');
      const tabList = screen.getByTestId('tab-list');

      await waitFor(() => {
        assertBubblePositionVariables(bubble, tabList, screen.getByRole('tab', { selected: true }));
      });

      await setProps({ insertedTabWidth: 60 });

      const insertedTab = screen.getByTestId('inserted-tab');

      await waitFor(() => {
        assertBubblePositionVariables(bubble, tabList, screen.getByRole('tab', { selected: true }));
      });

      insertedTab.setAttribute('style', 'width: 120px; flex-shrink: 0;');

      await waitFor(() => {
        assertBubblePositionVariables(bubble, tabList, screen.getByRole('tab', { selected: true }));
      });
    });

    it('updates all indicators when a different tab resizes', async () => {
      await render(
        <Tabs.Root value={2}>
          <Tabs.List
            data-testid="tab-list"
            style={{ width: '300px', display: 'flex', overflow: 'hidden' }}
          >
            <Tabs.Tab data-testid="first-tab" value={1} style={{ width: '100px', flexShrink: 0 }}>
              One
            </Tabs.Tab>
            <Tabs.Tab value={2} style={{ width: '100px', flexShrink: 0 }}>
              Two
            </Tabs.Tab>
            <Tabs.Tab value={3} style={{ width: '100px', flexShrink: 0 }}>
              Three
            </Tabs.Tab>
            <Tabs.Indicator data-testid="bubble-1" />
            <Tabs.Indicator data-testid="bubble-2" />
          </Tabs.List>
        </Tabs.Root>,
      );

      const bubble1 = screen.getByTestId('bubble-1');
      const bubble2 = screen.getByTestId('bubble-2');
      const tabList = screen.getByTestId('tab-list');
      const firstTab = screen.getByTestId('first-tab');
      const activeTab = screen.getAllByRole('tab')[1];

      await waitFor(() => {
        assertBubblePositionVariables(bubble1, tabList, activeTab);
        assertBubblePositionVariables(bubble2, tabList, activeTab);
      });

      firstTab.setAttribute('style', 'width: 140px; flex-shrink: 0;');

      await waitFor(() => {
        assertBubblePositionVariables(bubble1, tabList, activeTab);
        assertBubblePositionVariables(bubble2, tabList, activeTab);
      });
    });

    it('perf: single tab resize does not fan out excessive indicator rerenders', async () => {
      const renderIndicatorSpy = vi.fn();

      const LoggingIndicator = React.forwardRef(function LoggingIndicator(
        props: any & { renderSpy: () => void },
        ref: React.ForwardedRef<HTMLSpanElement>,
      ) {
        const { renderSpy, state, ...other } = props;
        renderSpy();
        return <span {...other} ref={ref} />;
      });

      await render(
        <Tabs.Root value={50}>
          <Tabs.List
            data-testid="tab-list"
            style={{ width: '1200px', display: 'flex', overflow: 'hidden' }}
          >
            {Array.from({ length: 100 }, (_, i) => (
              <Tabs.Tab
                data-testid={`tab-${i + 1}`}
                key={i}
                value={i + 1}
                style={{ width: '120px', flexShrink: 0 }}
              >
                {i + 1}
              </Tabs.Tab>
            ))}
            <Tabs.Indicator
              data-testid="bubble"
              render={<LoggingIndicator renderSpy={renderIndicatorSpy} />}
            />
          </Tabs.List>
        </Tabs.Root>,
      );

      const bubble = screen.getByTestId('bubble');
      const tabList = screen.getByTestId('tab-list');

      await waitFor(() => {
        assertBubblePositionVariables(bubble, tabList, screen.getByRole('tab', { selected: true }));
      });

      const firstTab = screen.getByTestId('tab-1');
      const initialRenderCount = renderIndicatorSpy.mock.calls.length;
      firstTab.setAttribute('style', 'width: 180px; flex-shrink: 0;');

      await waitFor(() => {
        assertBubblePositionVariables(bubble, tabList, screen.getByRole('tab', { selected: true }));
      });

      // React strict mode doubles render calls in tests.
      expect(renderIndicatorSpy.mock.calls.length - initialRenderCount).toBeLessThan(5);
    });
  });

  describe('pre-hydration rendering', () => {
    it('renders the inline pre-hydration script during server-side rendering', async () => {
      await renderToString(
        <Tabs.Root value={1}>
          <Tabs.List>
            <Tabs.Tab value={1}>One</Tabs.Tab>
            <Tabs.Indicator renderBeforeHydration />
          </Tabs.List>
        </Tabs.Root>,
      );

      expect(document.querySelector('script')).not.toBe(null);
    });
  });
});
