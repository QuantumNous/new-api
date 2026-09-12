import { expect, vi } from 'vitest';
import * as React from 'react';
import { screen } from '@mui/internal-test-utils';
import { Tabs } from '@base-ui/react/tabs';
import { createRenderer, describeConformance, isJSDOM } from '#test-utils';

describe('<Tabs.Tab />', () => {
  const { render } = createRenderer();

  describeConformance(<Tabs.Tab value="1" />, () => ({
    refInstanceof: window.HTMLButtonElement,
    testComponentPropWith: 'button',
    button: true,
    render: (node) =>
      render(
        <Tabs.Root>
          <Tabs.List>{node}</Tabs.List>
        </Tabs.Root>,
      ),
  }));

  describe('prop: nativeButton', () => {
    it('renders as an anchor and toggles selection when `nativeButton` is false', async () => {
      const { user } = await render(
        <Tabs.Root defaultValue="overview">
          <Tabs.List>
            <Tabs.Tab nativeButton={false} render={<a href="#overview" />} value="overview">
              Overview
            </Tabs.Tab>
            <Tabs.Tab nativeButton={false} render={<a href="#details" />} value="details">
              Details
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>,
      );

      const tabs = screen.getAllByRole('tab');
      expect(tabs[0].tagName).toBe('A');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'false');

      await user.click(tabs[1]);

      expect(tabs[0]).toHaveAttribute('aria-selected', 'false');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('state', () => {
    it.skipIf(isJSDOM)('exposes tab activation direction through the render prop', async () => {
      const tabRenderMock = vi.fn();

      const { setProps } = await render(
        <Tabs.Root value={0}>
          <Tabs.List>
            <Tabs.Tab
              value={0}
              render={(props, state) => {
                tabRenderMock({ value: 0, ...state });
                return <button {...props} />;
              }}
            >
              Tab 0
            </Tabs.Tab>
            <Tabs.Tab
              value={1}
              render={(props, state) => {
                tabRenderMock({ value: 1, ...state });
                return <button {...props} />;
              }}
            >
              Tab 1
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>,
      );

      tabRenderMock.mockClear();

      await setProps({ value: 1 });

      expect(
        tabRenderMock.mock.calls.some(
          ([state]) =>
            state.value === 1 && state.active === true && state.tabActivationDirection === 'right',
        ),
      ).toBe(true);
    });
  });
});
