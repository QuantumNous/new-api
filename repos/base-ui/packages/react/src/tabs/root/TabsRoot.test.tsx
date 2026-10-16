import { expect, vi } from 'vitest';
import * as React from 'react';
import { act, flushMicrotasks, fireEvent, screen, waitFor } from '@mui/internal-test-utils';
import { DirectionProvider, type TextDirection } from '@base-ui/react/direction-provider';
import { Popover } from '@base-ui/react/popover';
import { Dialog } from '@base-ui/react/dialog';
import { Tabs } from '@base-ui/react/tabs';
import { createRenderer, describeConformance, isJSDOM } from '#test-utils';

describe('<Tabs.Root />', () => {
  const { render } = createRenderer();

  beforeEach(function beforeHook({ skip }) {
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

    // The test fails on Safari with just:
    //
    // container.scrollLeft = 200;
    // expect(container.scrollLeft).toBe(200); 💥
    if (isSafari) {
      skip();
    }
  });

  describeConformance(<Tabs.Root value={0} />, () => ({
    render,
    refInstanceof: window.HTMLDivElement,
  }));

  describe('prop: children', () => {
    it('should accept a null child', async () => {
      await render(
        <Tabs.Root value={0}>
          {null}
          <Tabs.List>
            <Tabs.Tab value={1} />
          </Tabs.List>
        </Tabs.Root>,
      );

      expect(screen.getAllByRole('tab')).toHaveLength(1);
    });

    it('should support empty children', async () => {
      await render(<Tabs.Root value={1} />);
    });

    it('puts the selected child in tab order', async () => {
      const { setProps } = await render(
        <Tabs.Root value={1}>
          <Tabs.List>
            <Tabs.Tab value={0} />
            <Tabs.Tab value={1} />
          </Tabs.List>
        </Tabs.Root>,
      );

      expect(screen.getAllByRole('tab').map((tab) => tab.tabIndex)).toEqual([-1, 0]);

      await setProps({ value: 0 });

      expect(screen.getAllByRole('tab').map((tab) => tab.tabIndex)).toEqual([0, -1]);
    });

    it('sets the aria-labelledby attribute on tab panels to the corresponding tab id', async () => {
      await render(
        <Tabs.Root defaultValue="tab-0">
          <Tabs.List>
            <Tabs.Tab value="tab-0" />
            <Tabs.Tab value="tab-1" id="explicit-tab-id-1" />
            <Tabs.Tab value="tab-2" />
            <Tabs.Tab value="tab-3" id="explicit-tab-id-3" />
          </Tabs.List>
          <Tabs.Panel value="tab-1" keepMounted />
          <Tabs.Panel value="tab-0" keepMounted />
          <Tabs.Panel value="tab-2" keepMounted />
          <Tabs.Panel value="tab-3" keepMounted />
        </Tabs.Root>,
      );

      const tabs = screen.getAllByRole('tab');
      const tabPanels = screen.getAllByRole('tabpanel', { hidden: true });

      expect(tabPanels[0]).toHaveAttribute('aria-labelledby', tabs[1].id);
      expect(tabPanels[1]).toHaveAttribute('aria-labelledby', tabs[0].id);
      expect(tabPanels[2]).toHaveAttribute('aria-labelledby', tabs[2].id);
      expect(tabPanels[3]).toHaveAttribute('aria-labelledby', tabs[3].id);
    });

    it('sets the aria-controls attribute on tabs to the corresponding tab panel id', async () => {
      await render(
        <Tabs.Root defaultValue="tab-0">
          <Tabs.List>
            <Tabs.Tab value="tab-0" />
            <Tabs.Tab value="tab-1" id="explicit-tab-id-1" />
            <Tabs.Tab value="tab-2" />
            <Tabs.Tab value="tab-3" id="explicit-tab-id-3" />
          </Tabs.List>
          <Tabs.Panel value="tab-1" keepMounted />
          <Tabs.Panel value="tab-0" keepMounted />
          <Tabs.Panel value="tab-2" keepMounted />
          <Tabs.Panel value="tab-3" keepMounted />
        </Tabs.Root>,
      );

      const tabs = screen.getAllByRole('tab');
      const tabPanels = screen.getAllByRole('tabpanel', { hidden: true });

      expect(tabs[0]).toHaveAttribute('aria-controls', tabPanels[1].id);
      expect(tabs[1]).toHaveAttribute('aria-controls', tabPanels[0].id);
      expect(tabs[2]).toHaveAttribute('aria-controls', tabPanels[2].id);
      expect(tabs[3]).toHaveAttribute('aria-controls', tabPanels[3].id);
    });

    it('sets aria-controls on the first tab when no value is provided', async () => {
      await render(
        <Tabs.Root>
          <Tabs.List>
            <Tabs.Tab value={0} />
            <Tabs.Tab value={1} />
          </Tabs.List>
          <Tabs.Panel value={0} keepMounted />
          <Tabs.Panel value={1} keepMounted />
        </Tabs.Root>,
      );

      const tabs = screen.getAllByRole('tab');
      const tabPanels = screen.getAllByRole('tabpanel', { hidden: true });

      expect(tabs[0]).toHaveAttribute('aria-controls', tabPanels[0].id);
      expect(tabs[1]).toHaveAttribute('aria-controls', tabPanels[1].id);
      expect(tabPanels[0]).toHaveAttribute('aria-labelledby', tabs[0].id);
      expect(tabPanels[1]).toHaveAttribute('aria-labelledby', tabs[1].id);
    });

    it('syncs aria-controls to the mounted tab panel when keepMounted is false', async () => {
      const { user } = await render(
        <Tabs.Root defaultValue="tab-0">
          <Tabs.List>
            <Tabs.Tab value="tab-0">Tab 0</Tabs.Tab>
            <Tabs.Tab value="tab-1">Tab 1</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="tab-0">Panel 0</Tabs.Panel>
          <Tabs.Panel value="tab-1">Panel 1</Tabs.Panel>
        </Tabs.Root>,
      );

      const tabs = screen.getAllByRole('tab');
      const [firstTabPanel] = screen.getAllByRole('tabpanel');

      expect(tabs[0]).toHaveAttribute('aria-controls', firstTabPanel.id);
      expect(tabs[1]).not.toHaveAttribute('aria-controls');

      await user.click(tabs[1]);

      await waitFor(() => {
        const [secondTabPanel] = screen.getAllByRole('tabpanel');

        expect(secondTabPanel).toHaveTextContent('Panel 1');
        expect(tabs[0]).not.toHaveAttribute('aria-controls');
        expect(tabs[1]).toHaveAttribute('aria-controls', secondTabPanel.id);
      });
    });
  });

  describe('prop: value', () => {
    it('should pass selected prop to children', async () => {
      const tabs = (
        <Tabs.Root value={1}>
          <Tabs.List>
            <Tabs.Tab value={0} />
            <Tabs.Tab value={1} />
          </Tabs.List>
        </Tabs.Root>
      );

      await render(tabs);
      const tabElements = screen.getAllByRole('tab');
      expect(tabElements[0]).toHaveAttribute('aria-selected', 'false');
      expect(tabElements[1]).toHaveAttribute('aria-selected', 'true');
    });

    it('should support values of different types', async () => {
      const tabValues = [0, '1', { value: 2 }, () => 3, Symbol('4'), /5/];

      await render(
        <Tabs.Root>
          <Tabs.List>
            {tabValues.map((value, index) => (
              <Tabs.Tab key={index} value={value} />
            ))}
          </Tabs.List>
          {tabValues.map((value, index) => (
            <Tabs.Panel key={index} value={value} keepMounted />
          ))}
        </Tabs.Root>,
      );

      const tabElements = screen.getAllByRole('tab');
      const tabPanelElements = screen.getAllByRole('tabpanel', { hidden: true });

      await Promise.allSettled(
        tabValues.map(async (value, index) => {
          expect(tabPanelElements[index]).toHaveAttribute('aria-labelledby', tabElements[index].id);

          await act(() => {
            tabElements[index].click();
          });

          expect(tabPanelElements[index]).not.toHaveAttribute('hidden');
        }),
      );
    });
  });

  describe('disabled tabs', () => {
    it('should select the second tab when the first one is disabled', async () => {
      await render(
        <Tabs.Root>
          <Tabs.List>
            <Tabs.Tab value={0} disabled>
              Disabled tab
            </Tabs.Tab>
            <Tabs.Tab value={1}>Enabled tab</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value={0} keepMounted>
            Disabled panel
          </Tabs.Panel>
          <Tabs.Panel value={1} keepMounted>
            Enabled panel
          </Tabs.Panel>
        </Tabs.Root>,
      );

      const [disabledTab, enabledTab] = screen.getAllByRole('tab');
      const [disabledPanel, enabledPanel] = screen.getAllByRole('tabpanel', { hidden: true });

      expect(disabledTab).toHaveAttribute('aria-selected', 'false');
      expect(enabledTab).toHaveAttribute('aria-selected', 'true');
      expect(disabledPanel).toHaveAttribute('hidden');
      expect(enabledPanel).not.toHaveAttribute('hidden');
      expect(enabledPanel).toHaveTextContent('Enabled panel');
    });

    it('should select the third tab when first two tabs are disabled', async () => {
      await render(
        <Tabs.Root>
          <Tabs.List>
            <Tabs.Tab value={0} disabled data-testid="tab-0">
              Tab 0
            </Tabs.Tab>
            <Tabs.Tab value={1} disabled data-testid="tab-1">
              Tab 1
            </Tabs.Tab>
            <Tabs.Tab value={2} data-testid="tab-2">
              Tab 2
            </Tabs.Tab>
            <Tabs.Tab value={3} data-testid="tab-3">
              Tab 3
            </Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value={0}>Panel 0</Tabs.Panel>
          <Tabs.Panel value={1}>Panel 1</Tabs.Panel>
          <Tabs.Panel value={2}>Panel 2</Tabs.Panel>
          <Tabs.Panel value={3}>Panel 3</Tabs.Panel>
        </Tabs.Root>,
      );

      const tabs = screen.getAllByRole('tab');

      // The first non-disabled tab (tab 2) should be selected
      expect(tabs[2]).toHaveAttribute('aria-selected', 'true');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'false');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
      expect(tabs[3]).toHaveAttribute('aria-selected', 'false');
    });

    it('should still honor explicit defaultValue even if it points to a disabled tab', async () => {
      await render(
        <Tabs.Root defaultValue={0}>
          <Tabs.List>
            <Tabs.Tab value={0} disabled data-testid="tab-0">
              Tab 0
            </Tabs.Tab>
            <Tabs.Tab value={1} data-testid="tab-1">
              Tab 1
            </Tabs.Tab>
            <Tabs.Tab value={2} data-testid="tab-2">
              Tab 2
            </Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value={0}>Panel 0</Tabs.Panel>
          <Tabs.Panel value={1}>Panel 1</Tabs.Panel>
          <Tabs.Panel value={2}>Panel 2</Tabs.Panel>
        </Tabs.Root>,
      );

      const tabs = screen.getAllByRole('tab');

      // The explicitly set disabled tab should be selected
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
      expect(tabs[2]).toHaveAttribute('aria-selected', 'false');
    });

    it('continues honoring an initially disabled explicit defaultValue after defaultValue changes', async () => {
      const { setProps } = await render(
        <Tabs.Root defaultValue={0}>
          <Tabs.List>
            <Tabs.Tab value={0} disabled>
              Tab 0
            </Tabs.Tab>
            <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
            <Tabs.Tab value={2}>Tab 2</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>,
      );

      const tabs = screen.getAllByRole('tab');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');

      await expect(async () => {
        await setProps({ defaultValue: 1 });
      }).toErrorDev(
        'Base UI: A component is changing the default value state of an uncontrolled Tabs after being initialized.',
      );

      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
      expect(tabs[2]).toHaveAttribute('aria-selected', 'false');
    });

    it('should still honor explicit value prop even if it points to a disabled tab', async () => {
      await render(
        <Tabs.Root value={0}>
          <Tabs.List>
            <Tabs.Tab value={0} disabled data-testid="tab-0">
              Tab 0
            </Tabs.Tab>
            <Tabs.Tab value={1} data-testid="tab-1">
              Tab 1
            </Tabs.Tab>
            <Tabs.Tab value={2} data-testid="tab-2">
              Tab 2
            </Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value={0}>Panel 0</Tabs.Panel>
          <Tabs.Panel value={1}>Panel 1</Tabs.Panel>
          <Tabs.Panel value={2}>Panel 2</Tabs.Panel>
        </Tabs.Root>,
      );

      const tabs = screen.getAllByRole('tab');

      // The explicitly set disabled tab should be selected
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
      expect(tabs[2]).toHaveAttribute('aria-selected', 'false');
    });

    it('does not set tabIndex=0 on disabled tabs when they are programmatically selected', async () => {
      const { setProps } = await render(
        <Tabs.Root value={1}>
          <Tabs.List>
            <Tabs.Tab value={0} disabled>
              Tab 0
            </Tabs.Tab>
            <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
            <Tabs.Tab value={2}>Tab 2</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value={0}>Panel 0</Tabs.Panel>
          <Tabs.Panel value={1}>Panel 1</Tabs.Panel>
          <Tabs.Panel value={2}>Panel 2</Tabs.Panel>
        </Tabs.Root>,
      );

      const tabs = screen.getAllByRole('tab');

      // Initially, tab 1 is selected and should be highlighted (tabIndex=0)
      expect(tabs[1]).toHaveAttribute('tabindex', '0');
      expect(tabs[0]).toHaveAttribute('tabindex', '-1');
      expect(tabs[2]).toHaveAttribute('tabindex', '-1');

      // Programmatically select the disabled tab 0
      await setProps({ value: 0 });
      await flushMicrotasks();

      // The disabled tab should be selected but NOT highlighted (tabIndex should remain -1)
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
      expect(tabs[0]).toHaveAttribute('tabindex', '-1');

      // The previously highlighted tab should retain the highlight
      expect(tabs[1]).toHaveAttribute('tabindex', '0');
    });

    it('does not select any tab when all tabs are disabled', async () => {
      await render(
        <Tabs.Root>
          <Tabs.List>
            <Tabs.Tab value={0} disabled>
              Tab 0
            </Tabs.Tab>
            <Tabs.Tab value={1} disabled>
              Tab 1
            </Tabs.Tab>
            <Tabs.Tab value={2} disabled>
              Tab 2
            </Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value={0} keepMounted>
            Panel 0
          </Tabs.Panel>
          <Tabs.Panel value={1} keepMounted>
            Panel 1
          </Tabs.Panel>
          <Tabs.Panel value={2} keepMounted>
            Panel 2
          </Tabs.Panel>
        </Tabs.Root>,
      );

      const tabs = screen.getAllByRole('tab');
      const panels = screen.getAllByRole('tabpanel', { hidden: true });

      // No tab should be selected
      expect(tabs[0]).toHaveAttribute('aria-selected', 'false');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
      expect(tabs[2]).toHaveAttribute('aria-selected', 'false');

      // All panels should be hidden
      expect(panels[0]).toHaveAttribute('hidden');
      expect(panels[1]).toHaveAttribute('hidden');
      expect(panels[2]).toHaveAttribute('hidden');
    });
  });

  describe('prop: onValueChange', () => {
    it('when `activateOnFocus = true` should call onValueChange on pointerdown', async () => {
      const handleChange = vi.fn();
      const handlePointerDown = vi.fn();
      const { user } = await render(
        <Tabs.Root value={0} onValueChange={handleChange}>
          <Tabs.List activateOnFocus>
            <Tabs.Tab value={0} />
            <Tabs.Tab value={1} onPointerDown={handlePointerDown} />
          </Tabs.List>
        </Tabs.Root>,
      );

      await user.pointer({ keys: '[MouseLeft>]', target: screen.getAllByRole('tab')[1] });
      expect(handleChange.mock.calls.length).toBe(1);
      expect(handlePointerDown.mock.calls.length).toBe(1);
    });

    it.skipIf(isJSDOM)('should call onValueChange when clicking', async () => {
      const handleChange = vi.fn();

      await render(
        <Tabs.Root value={0} onValueChange={handleChange}>
          <Tabs.List>
            <Tabs.Tab value={0} />
            <Tabs.Tab value={1} />
          </Tabs.List>
        </Tabs.Root>,
      );

      fireEvent.click(screen.getAllByRole('tab')[1]);
      expect(handleChange.mock.calls.length).toBe(1);
      expect(handleChange.mock.calls[0][0]).toBe(1);
      expect(handleChange.mock.calls[0][1].activationDirection).toBe('right');
    });

    it('should not call onValueChange on non-main button clicks', async () => {
      const handleChange = vi.fn();

      await render(
        <Tabs.Root value={0} onValueChange={handleChange}>
          <Tabs.List>
            <Tabs.Tab value={0} />
            <Tabs.Tab value={1} />
          </Tabs.List>
        </Tabs.Root>,
      );

      fireEvent.click(screen.getAllByRole('tab')[1], { button: 2 });
      expect(handleChange.mock.calls.length).toBe(0);
    });

    it('should not call onValueChange when already active', async () => {
      const handleChange = vi.fn();

      await render(
        <Tabs.Root value={0} onValueChange={handleChange}>
          <Tabs.List>
            <Tabs.Tab value={0} />
            <Tabs.Tab value={1} />
          </Tabs.List>
        </Tabs.Root>,
      );

      fireEvent.click(screen.getAllByRole('tab')[0]);
      expect(handleChange.mock.calls.length).toBe(0);
    });

    it('when `activateOnFocus = true` should call onValueChange if an unactive tab gets focused', async () => {
      const handleChange = vi.fn();

      await render(
        <Tabs.Root value={0} onValueChange={handleChange}>
          <Tabs.List activateOnFocus>
            <Tabs.Tab value={0} />
            <Tabs.Tab value={1} />
          </Tabs.List>
        </Tabs.Root>,
      );

      const [firstTab] = screen.getAllByRole('tab');

      await act(async () => {
        firstTab.focus();
      });

      fireEvent.keyDown(firstTab, { key: 'ArrowRight' });
      await flushMicrotasks();

      expect(handleChange.mock.calls.length).toBe(1);
      expect(handleChange.mock.calls[0][0]).toBe(1);
    });

    it('when `activateOnFocus = false` should not call onValueChange if an unactive tab gets focused', async () => {
      const handleChange = vi.fn();

      await render(
        <Tabs.Root value={1} onValueChange={handleChange}>
          <Tabs.List activateOnFocus={false}>
            <Tabs.Tab value={0} />
            <Tabs.Tab value={1} />
          </Tabs.List>
        </Tabs.Root>,
      );

      const [firstTab] = screen.getAllByRole('tab');

      await act(async () => {
        firstTab.focus();
      });

      expect(handleChange.mock.calls.length).toBe(0);
    });

    it('calls onValueChange when auto-selecting the first tab on mount', async () => {
      const handleChange = vi.fn();

      await render(
        <Tabs.Root onValueChange={handleChange}>
          <Tabs.List>
            <Tabs.Tab value={0}>Tab 0</Tabs.Tab>
            <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
            <Tabs.Tab value={2}>Tab 2</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>,
      );

      expect(handleChange.mock.calls.length).toBe(1);
      expect(handleChange.mock.calls[0][0]).toBe(0);
      expect(handleChange.mock.calls[0][1].reason).toBe('initial');
      expect(handleChange.mock.calls[0][1].activationDirection).toBe('none');

      const tabs = screen.getAllByRole('tab');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    });

    it('calls onValueChange with the selected value when the implicit default matches a later tab', async () => {
      const handleChange = vi.fn();

      await render(
        <Tabs.Root onValueChange={handleChange}>
          <Tabs.List>
            <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
            <Tabs.Tab value={0}>Tab 0</Tabs.Tab>
            <Tabs.Tab value={2}>Tab 2</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>,
      );

      expect(handleChange.mock.calls.length).toBe(1);
      expect(handleChange.mock.calls[0][0]).toBe(0);
      expect(handleChange.mock.calls[0][1].reason).toBe('initial');

      const tabs = screen.getAllByRole('tab');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'false');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    });

    it('calls onValueChange when the implicit first tab is disabled', async () => {
      const handleChange = vi.fn();

      await render(
        <Tabs.Root onValueChange={handleChange}>
          <Tabs.List>
            <Tabs.Tab value={0} disabled>
              Tab 0
            </Tabs.Tab>
            <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
            <Tabs.Tab value={2}>Tab 2</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>,
      );

      expect(handleChange.mock.calls.length).toBe(1);
      expect(handleChange.mock.calls[0][0]).toBe(1);
      expect(handleChange.mock.calls[0][1].reason).toBe('initial');
      expect(handleChange.mock.calls[0][1].activationDirection).toBe('none');

      const tabs = screen.getAllByRole('tab');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    });

    it('does not cancel automatic value changes', async () => {
      const handleChange = vi.fn(
        (_value: Tabs.Tab.Value, eventDetails: Tabs.Root.ChangeEventDetails) => {
          eventDetails.cancel();
        },
      );

      await render(
        <Tabs.Root onValueChange={handleChange}>
          <Tabs.List>
            <Tabs.Tab value={0} disabled>
              Tab 0
            </Tabs.Tab>
            <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>,
      );

      expect(handleChange.mock.calls.length).toBe(1);
      expect(handleChange.mock.calls[0][0]).toBe(1);
      expect(handleChange.mock.calls[0][1].reason).toBe('initial');
      expect(handleChange.mock.calls[0][1].event).toBeInstanceOf(Event);
      expect(handleChange.mock.calls[0][1].event.type).toBe('base-ui');
      expect(handleChange.mock.calls[0][1].trigger).toBe(undefined);
      expect(handleChange.mock.calls[0][1].activationDirection).toBe('none');

      const tabs = screen.getAllByRole('tab');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'false');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    });

    it('does not move an uncontrolled selection when a user-initiated change is canceled', async () => {
      const handleChange = vi.fn(
        (_value: Tabs.Tab.Value, eventDetails: Tabs.Root.ChangeEventDetails) => {
          if (eventDetails.reason === 'none') {
            eventDetails.cancel();
          }
        },
      );

      const { user } = await render(
        <Tabs.Root defaultValue={0} onValueChange={handleChange}>
          <Tabs.List>
            <Tabs.Tab value={0}>Tab 0</Tabs.Tab>
            <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>,
      );

      const tabs = screen.getAllByRole('tab');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');

      await user.click(tabs[1]);

      expect(handleChange).toHaveBeenCalledTimes(1);
      expect(handleChange.mock.calls[0][1].reason).toBe('none');
      // The canceled click must not commit the new value in an uncontrolled root.
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
    });

    it('calls onValueChange with null when all tabs are initially disabled', async () => {
      const handleChange = vi.fn();

      await render(
        <Tabs.Root onValueChange={handleChange}>
          <Tabs.List>
            <Tabs.Tab value={0} disabled>
              Tab 0
            </Tabs.Tab>
            <Tabs.Tab value={1} disabled>
              Tab 1
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>,
      );

      expect(handleChange.mock.calls.length).toBe(1);
      expect(handleChange.mock.calls[0][0]).toBe(null);
      expect(handleChange.mock.calls[0][1].reason).toBe('initial');
      expect(handleChange.mock.calls[0][1].activationDirection).toBe('none');

      const tabs = screen.getAllByRole('tab');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'false');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
    });

    it('does not emit missing when an enabled tab appears after all tabs were disabled', async () => {
      const handleChange = vi.fn();

      function TestComponent({ enableSecond }: { enableSecond: boolean }) {
        return (
          <Tabs.Root onValueChange={handleChange}>
            <Tabs.List>
              <Tabs.Tab value={0} disabled>
                Tab 0
              </Tabs.Tab>
              <Tabs.Tab value={1} disabled={!enableSecond}>
                Tab 1
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.Root>
        );
      }

      const { setProps } = await render(<TestComponent enableSecond={false} />);

      expect(handleChange.mock.calls.length).toBe(1);
      expect(handleChange.mock.calls[0][0]).toBe(null);
      expect(handleChange.mock.calls[0][1].reason).toBe('initial');

      await setProps({ enableSecond: true });

      expect(handleChange.mock.calls.length).toBe(1);
      const tabs = screen.getAllByRole('tab');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'false');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
    });

    it('does not call onValueChange on initial render when defaultValue is provided', async () => {
      const handleChange = vi.fn();

      await render(
        <Tabs.Root defaultValue={1} onValueChange={handleChange}>
          <Tabs.List>
            <Tabs.Tab value={0}>Tab 0</Tabs.Tab>
            <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
            <Tabs.Tab value={2}>Tab 2</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>,
      );

      expect(handleChange.mock.calls.length).toBe(0);

      const tabs = screen.getAllByRole('tab');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    });

    it('does not call onValueChange on initial render when defaultValue is null', async () => {
      const handleChange = vi.fn();

      await render(
        <Tabs.Root defaultValue={null} onValueChange={handleChange}>
          <Tabs.List>
            <Tabs.Tab value={0}>Tab 0</Tabs.Tab>
            <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>,
      );

      expect(handleChange.mock.calls.length).toBe(0);

      const tabs = screen.getAllByRole('tab');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'false');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
    });

    it('treats defaultValue={undefined} as an implicit default when the first tab is disabled', async () => {
      const handleChange = vi.fn();

      await render(
        <Tabs.Root defaultValue={undefined} onValueChange={handleChange}>
          <Tabs.List>
            <Tabs.Tab value={0} disabled>
              Tab 0
            </Tabs.Tab>
            <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
            <Tabs.Tab value={2}>Tab 2</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>,
      );

      expect(handleChange.mock.calls.length).toBe(1);
      expect(handleChange.mock.calls[0][0]).toBe(1);
      expect(handleChange.mock.calls[0][1].reason).toBe('initial');
      expect(handleChange.mock.calls[0][1].activationDirection).toBe('none');

      const tabs = screen.getAllByRole('tab');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'false');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    });

    it('calls onValueChange when the selected tab becomes disabled', async () => {
      const handleChange = vi.fn();

      function TestComponent({ disableFirst }: { disableFirst: boolean }) {
        return (
          <Tabs.Root defaultValue={0} onValueChange={handleChange}>
            <Tabs.List>
              <Tabs.Tab value={0} disabled={disableFirst}>
                Tab 0
              </Tabs.Tab>
              <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
              <Tabs.Tab value={2}>Tab 2</Tabs.Tab>
            </Tabs.List>
          </Tabs.Root>
        );
      }

      const { setProps } = await render(<TestComponent disableFirst={false} />);

      await setProps({ disableFirst: true });

      await waitFor(() => {
        expect(handleChange.mock.calls.length).toBe(1);
        expect(handleChange.mock.calls[0][0]).toBe(1);
        expect(handleChange.mock.calls[0][1].reason).toBe('disabled');
        expect(handleChange.mock.calls[0][1].activationDirection).toBe('none');
      });

      const tabs = screen.getAllByRole('tab');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'false');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
    });

    it('calls onValueChange when an explicit disabled default becomes disabled again', async () => {
      const handleChange = vi.fn();

      function TestComponent({ disableFirst }: { disableFirst: boolean }) {
        return (
          <Tabs.Root defaultValue={0} onValueChange={handleChange}>
            <Tabs.List>
              <Tabs.Tab value={0} disabled={disableFirst}>
                Tab 0
              </Tabs.Tab>
              <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
            </Tabs.List>
          </Tabs.Root>
        );
      }

      const { setProps } = await render(<TestComponent disableFirst />);

      expect(handleChange.mock.calls.length).toBe(0);
      expect(screen.getAllByRole('tab')[0]).toHaveAttribute('aria-selected', 'true');

      await setProps({ disableFirst: false });

      expect(handleChange.mock.calls.length).toBe(0);
      expect(screen.getAllByRole('tab')[0]).toHaveAttribute('aria-selected', 'true');

      await setProps({ disableFirst: true });

      await waitFor(() => {
        expect(handleChange.mock.calls.length).toBe(1);
        expect(handleChange.mock.calls[0][0]).toBe(1);
        expect(handleChange.mock.calls[0][1].reason).toBe('disabled');
      });
      expect(screen.getAllByRole('tab')[1]).toHaveAttribute('aria-selected', 'true');
    });

    it('calls onValueChange when the selected tab becomes disabled with keepMounted panels', async () => {
      const handleChange = vi.fn();

      function TestComponent({ disableFirst }: { disableFirst: boolean }) {
        return (
          <Tabs.Root defaultValue={0} onValueChange={handleChange}>
            <Tabs.List>
              <Tabs.Tab value={0} disabled={disableFirst}>
                Tab 0
              </Tabs.Tab>
              <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value={0} keepMounted>
              Panel 0
            </Tabs.Panel>
            <Tabs.Panel value={1} keepMounted>
              Panel 1
            </Tabs.Panel>
          </Tabs.Root>
        );
      }

      const { setProps } = await render(<TestComponent disableFirst={false} />);

      await setProps({ disableFirst: true });

      await waitFor(() => {
        expect(handleChange.mock.calls.length).toBe(1);
        expect(handleChange.mock.calls[0][0]).toBe(1);
        expect(handleChange.mock.calls[0][1].reason).toBe('disabled');
      });

      const panels = screen.getAllByRole('tabpanel', { hidden: true });
      expect(panels[0]).toHaveAttribute('hidden');
      expect(panels[1]).not.toHaveAttribute('hidden');
    });

    it('calls onValueChange when the selected tab is removed', async () => {
      const handleChange = vi.fn();

      function TestComponent({ showFirstTab }: { showFirstTab: boolean }) {
        return (
          <Tabs.Root defaultValue={0} onValueChange={handleChange}>
            <Tabs.List>
              {showFirstTab && <Tabs.Tab value={0}>Tab 0</Tabs.Tab>}
              <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
              <Tabs.Tab value={2}>Tab 2</Tabs.Tab>
            </Tabs.List>
          </Tabs.Root>
        );
      }

      const { setProps } = await render(<TestComponent showFirstTab />);

      await setProps({ showFirstTab: false });

      await waitFor(() => {
        expect(handleChange.mock.calls.length).toBe(1);
        expect(handleChange.mock.calls[0][0]).toBe(1);
        expect(handleChange.mock.calls[0][1].reason).toBe('missing');
      });

      const tabs = screen.getAllByRole('tab');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
      expect(tabs[0]).toHaveTextContent('Tab 1');
    });

    it('calls onValueChange with null when the selected tab is removed and no tabs remain', async () => {
      const handleChange = vi.fn();

      function TestComponent({ showTab }: { showTab: boolean }) {
        return (
          <Tabs.Root defaultValue={0} onValueChange={handleChange}>
            <Tabs.List>{showTab && <Tabs.Tab value={0}>Tab 0</Tabs.Tab>}</Tabs.List>
            <Tabs.Panel value={0} keepMounted>
              Panel 0
            </Tabs.Panel>
          </Tabs.Root>
        );
      }

      const { setProps } = await render(<TestComponent showTab />);

      expect(screen.getByRole('tabpanel')).not.toHaveAttribute('hidden');

      await setProps({ showTab: false });

      await waitFor(() => {
        expect(handleChange.mock.calls.length).toBe(1);
        expect(handleChange.mock.calls[0][0]).toBe(null);
        expect(handleChange.mock.calls[0][1].reason).toBe('missing');
      });

      expect(screen.queryAllByRole('tab').length).toBe(0);
      expect(screen.getByRole('tabpanel', { hidden: true })).toHaveAttribute('hidden');
    });

    it('calls onValueChange when an explicit defaultValue points at a tab that is never present', async () => {
      const handleChange = vi.fn();

      await render(
        <Tabs.Root defaultValue={0} onValueChange={handleChange}>
          <Tabs.List>
            <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
            <Tabs.Tab value={2}>Tab 2</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>,
      );

      await waitFor(() => {
        expect(handleChange.mock.calls.length).toBe(1);
        expect(handleChange.mock.calls[0][0]).toBe(1);
        expect(handleChange.mock.calls[0][1].reason).toBe('missing');
      });

      const tabs = screen.getAllByRole('tab');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    });

    it('does not call onValueChange when a controlled selected tab becomes disabled', async () => {
      const handleChange = vi.fn();

      function TestComponent({ disableFirst }: { disableFirst: boolean }) {
        return (
          <Tabs.Root value={0} onValueChange={handleChange}>
            <Tabs.List>
              <Tabs.Tab value={0} disabled={disableFirst}>
                Tab 0
              </Tabs.Tab>
              <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
            </Tabs.List>
          </Tabs.Root>
        );
      }

      const { setProps } = await render(<TestComponent disableFirst={false} />);

      await setProps({ disableFirst: true });

      expect(handleChange.mock.calls.length).toBe(0);
      const tabs = screen.getAllByRole('tab');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
    });

    it('does not call onValueChange when a controlled selected tab is removed', async () => {
      const handleChange = vi.fn();

      function TestComponent({ showFirstTab }: { showFirstTab: boolean }) {
        return (
          <Tabs.Root value={0} onValueChange={handleChange}>
            <Tabs.List>
              {showFirstTab && <Tabs.Tab value={0}>Tab 0</Tabs.Tab>}
              <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
            </Tabs.List>
          </Tabs.Root>
        );
      }

      const { setProps } = await render(<TestComponent showFirstTab />);

      await setProps({ showFirstTab: false });

      expect(handleChange.mock.calls.length).toBe(0);
      const tabs = screen.getAllByRole('tab');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'false');
    });
  });

  describe('prop: orientation', () => {
    it('does not add aria-orientation by default', async () => {
      await render(
        <Tabs.Root value={0}>
          <Tabs.List>
            <Tabs.Root />
          </Tabs.List>
        </Tabs.Root>,
      );

      expect(screen.getByRole('tablist')).not.toHaveAttribute('aria-orientation');
    });

    it('adds the proper aria-orientation when vertical', async () => {
      await render(
        <Tabs.Root value={0} orientation="vertical">
          <Tabs.List>
            <Tabs.Root />
          </Tabs.List>
        </Tabs.Root>,
      );

      expect(screen.getByRole('tablist')).toHaveAttribute('aria-orientation', 'vertical');
    });
  });

  describe('pointer navigation', () => {
    it('selects the clicked tab', async () => {
      const { user } = await render(
        <Tabs.Root defaultValue={0}>
          <Tabs.List activateOnFocus={false}>
            <Tabs.Tab value={0}>Tab 1</Tabs.Tab>
            <Tabs.Tab value={1}>Tab 2</Tabs.Tab>
            <Tabs.Tab value={2}>Tab 3</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value={0} keepMounted>
            Panel 1
          </Tabs.Panel>
          <Tabs.Panel value={1} keepMounted>
            Panel 2
          </Tabs.Panel>
          <Tabs.Panel value={2} keepMounted>
            Panel 3
          </Tabs.Panel>
        </Tabs.Root>,
      );

      const tab2 = screen.getByRole('tab', { name: 'Tab 2' });
      await user.click(tab2);

      const panels = screen.getAllByRole('tabpanel', { hidden: true });

      expect(panels[0]).toHaveAttribute('hidden');
      expect(panels[1]).not.toHaveAttribute('hidden');
      expect(panels[2]).toHaveAttribute('hidden');
    });

    it('does not select the clicked disabled tab', async () => {
      const { user } = await render(
        <Tabs.Root defaultValue={0}>
          <Tabs.List activateOnFocus={false}>
            <Tabs.Tab value={0}>Tab 1</Tabs.Tab>
            <Tabs.Tab disabled value={1}>
              Tab 2
            </Tabs.Tab>
            <Tabs.Tab value={2}>Tab 3</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value={0} keepMounted>
            Panel 1
          </Tabs.Panel>
          <Tabs.Panel value={1} keepMounted>
            Panel 2
          </Tabs.Panel>
          <Tabs.Panel value={2} keepMounted>
            Panel 3
          </Tabs.Panel>
        </Tabs.Root>,
      );

      const tab2 = screen.getByRole('tab', { name: 'Tab 2' });
      await user.click(tab2);

      const panels = screen.getAllByRole('tabpanel', { hidden: true });

      expect(panels[0]).not.toHaveAttribute('hidden');
      expect(panels[1]).toHaveAttribute('hidden');
      expect(panels[2]).toHaveAttribute('hidden');
    });
  });

  describe('keyboard navigation when focus is on a tab', () => {
    [
      ['horizontal', 'ltr', 'ArrowLeft', 'ArrowRight'],
      ['horizontal', 'rtl', 'ArrowRight', 'ArrowLeft'],
      ['vertical', undefined, 'ArrowUp', 'ArrowDown'],
    ].forEach((entry) => {
      const [orientation, direction, previousItemKey, nextItemKey] = entry;

      describe.skipIf(isJSDOM && direction === 'rtl')(
        `when focus is on a tab element in a ${orientation} ${direction ?? ''} tablist`,
        () => {
          describe(previousItemKey ?? '', () => {
            describe('with `activateOnFocus = false`', () => {
              it('moves focus to the last tab without activating it if focus is on the first tab', async () => {
                const handleChange = vi.fn();
                const handleKeyDown = vi.fn();

                await render(
                  <DirectionProvider direction={direction as TextDirection}>
                    <Tabs.Root
                      onValueChange={handleChange}
                      orientation={orientation as Tabs.Root.Props['orientation']}
                      value={0}
                    >
                      <Tabs.List activateOnFocus={false} onKeyDown={handleKeyDown}>
                        <Tabs.Tab value={0} />
                        <Tabs.Tab value={1} />
                        <Tabs.Tab value={2} />
                      </Tabs.List>
                    </Tabs.Root>
                  </DirectionProvider>,
                );

                const [firstTab, , lastTab] = screen.getAllByRole('tab');
                await act(async () => {
                  firstTab.focus();
                });

                fireEvent.keyDown(firstTab, { key: previousItemKey });
                await flushMicrotasks();

                expect(lastTab).toHaveFocus();
                expect(handleChange.mock.calls.length).toBe(0);
                expect(handleKeyDown.mock.calls.length).toBe(1);
                expect(handleKeyDown.mock.calls[0][0]).toHaveProperty('defaultPrevented', true);
              });

              it('moves focus to the previous tab without activating it', async () => {
                const handleChange = vi.fn();
                const handleKeyDown = vi.fn();

                await render(
                  <DirectionProvider direction={direction as TextDirection}>
                    <Tabs.Root
                      onValueChange={handleChange}
                      orientation={orientation as Tabs.Root.Props['orientation']}
                      value={1}
                    >
                      <Tabs.List activateOnFocus={false} onKeyDown={handleKeyDown}>
                        <Tabs.Tab value={0} />
                        <Tabs.Tab value={1} />
                        <Tabs.Tab value={2} />
                      </Tabs.List>
                    </Tabs.Root>
                  </DirectionProvider>,
                );

                const [firstTab, secondTab] = screen.getAllByRole('tab');
                await act(async () => {
                  secondTab.focus();
                });

                fireEvent.keyDown(secondTab, { key: previousItemKey });
                await flushMicrotasks();

                expect(firstTab).toHaveFocus();
                expect(handleChange.mock.calls.length).toBe(0);
                expect(handleKeyDown.mock.calls.length).toBe(1);
                expect(handleKeyDown.mock.calls[0][0]).toHaveProperty('defaultPrevented', true);
              });

              it('moves focus to a disabled tab without activating it', async () => {
                const handleKeyDown = vi.fn();

                await render(
                  <DirectionProvider direction={direction as TextDirection}>
                    <Tabs.Root
                      orientation={orientation as Tabs.Root.Props['orientation']}
                      value={2}
                    >
                      <Tabs.List activateOnFocus={false} onKeyDown={handleKeyDown}>
                        <Tabs.Tab value={0} />
                        <Tabs.Tab value={1} disabled />
                        <Tabs.Tab value={2} />
                      </Tabs.List>
                    </Tabs.Root>
                  </DirectionProvider>,
                );

                const [, disabledTab, lastTab] = screen.getAllByRole('tab');
                await act(async () => {
                  lastTab.focus();
                });

                fireEvent.keyDown(lastTab, { key: previousItemKey });
                await flushMicrotasks();

                expect(disabledTab).toHaveFocus();
                expect(handleKeyDown.mock.calls.length).toBe(1);
                expect(handleKeyDown.mock.calls[0][0]).toHaveProperty('defaultPrevented', true);
              });
            });

            describe('with `activateOnFocus = true`', () => {
              it('moves focus to the last tab while activating it if focus is on the first tab', async () => {
                const handleChange = vi.fn();
                const handleKeyDown = vi.fn();

                await render(
                  <DirectionProvider direction={direction as TextDirection}>
                    <Tabs.Root
                      onValueChange={handleChange}
                      orientation={orientation as Tabs.Root.Props['orientation']}
                      value={0}
                    >
                      <Tabs.List onKeyDown={handleKeyDown} activateOnFocus>
                        <Tabs.Tab value={0} />
                        <Tabs.Tab value={1} />
                        <Tabs.Tab value={2} />
                      </Tabs.List>
                    </Tabs.Root>
                  </DirectionProvider>,
                );

                const [firstTab, , lastTab] = screen.getAllByRole('tab');
                await act(async () => {
                  firstTab.focus();
                });

                fireEvent.keyDown(firstTab, { key: previousItemKey });
                await flushMicrotasks();

                expect(lastTab).toHaveFocus();
                expect(handleChange.mock.calls.length).toBe(1);
                expect(handleChange.mock.calls[0][0]).toBe(2);
                expect(handleKeyDown.mock.calls.length).toBe(1);
                expect(handleKeyDown.mock.calls[0][0]).toHaveProperty('defaultPrevented', true);
              });

              it('moves focus to the previous tab while activating it', async () => {
                const handleChange = vi.fn();
                const handleKeyDown = vi.fn();

                await render(
                  <DirectionProvider direction={direction as TextDirection}>
                    <Tabs.Root
                      onValueChange={handleChange}
                      orientation={orientation as Tabs.Root.Props['orientation']}
                      value={1}
                    >
                      <Tabs.List onKeyDown={handleKeyDown} activateOnFocus>
                        <Tabs.Tab value={0} />
                        <Tabs.Tab value={1} />
                        <Tabs.Tab value={2} />
                      </Tabs.List>
                    </Tabs.Root>
                  </DirectionProvider>,
                );

                const [firstTab, secondTab] = screen.getAllByRole('tab');
                await act(async () => {
                  secondTab.focus();
                });

                fireEvent.keyDown(secondTab, { key: previousItemKey });
                await flushMicrotasks();

                expect(firstTab).toHaveFocus();
                expect(handleChange.mock.calls.length).toBe(1);
                expect(handleChange.mock.calls[0][0]).toBe(0);
                expect(handleKeyDown.mock.calls.length).toBe(1);
                expect(handleKeyDown.mock.calls[0][0]).toHaveProperty('defaultPrevented', true);
              });
            });

            it('moves focus to a disabled tab without activating it', async () => {
              const handleKeyDown = vi.fn();

              await render(
                <DirectionProvider direction={direction as TextDirection}>
                  <Tabs.Root orientation={orientation as Tabs.Root.Props['orientation']} value={2}>
                    <Tabs.List onKeyDown={handleKeyDown}>
                      <Tabs.Tab value={0} />
                      <Tabs.Tab value={1} disabled />
                      <Tabs.Tab value={2} />
                    </Tabs.List>
                  </Tabs.Root>
                </DirectionProvider>,
              );

              const [, disabledTab, lastTab] = screen.getAllByRole('tab');
              await act(async () => {
                lastTab.focus();
              });

              fireEvent.keyDown(lastTab, { key: previousItemKey });
              await flushMicrotasks();

              expect(disabledTab).toHaveFocus();
              expect(handleKeyDown.mock.calls.length).toBe(1);
              expect(handleKeyDown.mock.calls[0][0]).toHaveProperty('defaultPrevented', true);
            });
          });

          describe(nextItemKey ?? '', () => {
            describe('with `activateOnFocus = false`', () => {
              it('moves focus to the first tab without activating it if focus is on the last tab', async () => {
                const handleChange = vi.fn();
                const handleKeyDown = vi.fn();

                await render(
                  <DirectionProvider direction={direction as TextDirection}>
                    <Tabs.Root
                      onValueChange={handleChange}
                      orientation={orientation as Tabs.Root.Props['orientation']}
                      value={2}
                    >
                      <Tabs.List activateOnFocus={false} onKeyDown={handleKeyDown}>
                        <Tabs.Tab value={0} />
                        <Tabs.Tab value={1} />
                        <Tabs.Tab value={2} />
                      </Tabs.List>
                    </Tabs.Root>
                  </DirectionProvider>,
                );

                const [firstTab, , lastTab] = screen.getAllByRole('tab');
                await act(async () => {
                  lastTab.focus();
                });

                fireEvent.keyDown(lastTab, { key: nextItemKey });
                await flushMicrotasks();

                expect(firstTab).toHaveFocus();
                expect(handleChange.mock.calls.length).toBe(0);
                expect(handleKeyDown.mock.calls.length).toBe(1);
                expect(handleKeyDown.mock.calls[0][0]).toHaveProperty('defaultPrevented', true);
              });

              it('moves focus to the next tab without activating it', async () => {
                const handleChange = vi.fn();
                const handleKeyDown = vi.fn();

                await render(
                  <DirectionProvider direction={direction as TextDirection}>
                    <Tabs.Root
                      onValueChange={handleChange}
                      orientation={orientation as Tabs.Root.Props['orientation']}
                      value={1}
                    >
                      <Tabs.List activateOnFocus={false} onKeyDown={handleKeyDown}>
                        <Tabs.Tab value={0} />
                        <Tabs.Tab value={1} />
                        <Tabs.Tab value={2} />
                      </Tabs.List>
                    </Tabs.Root>
                  </DirectionProvider>,
                );

                const [, secondTab, lastTab] = screen.getAllByRole('tab');
                await act(async () => {
                  secondTab.focus();
                });

                fireEvent.keyDown(secondTab, { key: nextItemKey });
                await flushMicrotasks();

                expect(lastTab).toHaveFocus();
                expect(handleChange.mock.calls.length).toBe(0);
                expect(handleKeyDown.mock.calls.length).toBe(1);
                expect(handleKeyDown.mock.calls[0][0]).toHaveProperty('defaultPrevented', true);
              });

              it('moves focus to a disabled tab without activating it', async () => {
                const handleChange = vi.fn();
                const handleKeyDown = vi.fn();

                await render(
                  <DirectionProvider direction={direction as TextDirection}>
                    <Tabs.Root
                      onValueChange={handleChange}
                      orientation={orientation as Tabs.Root.Props['orientation']}
                      value={0}
                    >
                      <Tabs.List activateOnFocus={false} onKeyDown={handleKeyDown}>
                        <Tabs.Tab value={0} />
                        <Tabs.Tab value={1} disabled />
                        <Tabs.Tab value={2} />
                      </Tabs.List>
                    </Tabs.Root>
                  </DirectionProvider>,
                );

                const [firstTab, disabledTab, thirdTab] = screen.getAllByRole('tab');
                await act(async () => {
                  firstTab.focus();
                });

                fireEvent.keyDown(firstTab, { key: nextItemKey });
                await flushMicrotasks();

                expect(disabledTab).toHaveFocus();
                expect(handleChange.mock.calls.length).toBe(0);
                expect(handleKeyDown.mock.calls.length).toBe(1);
                expect(handleKeyDown.mock.calls[0][0]).toHaveProperty('defaultPrevented', true);

                fireEvent.keyDown(disabledTab, { key: nextItemKey });
                await flushMicrotasks();
                expect(thirdTab).toHaveFocus();
              });
            });

            describe('with `activateOnFocus = true`', () => {
              it('moves focus to the first tab while activating it if focus is on the last tab', async () => {
                const handleChange = vi.fn();
                const handleKeyDown = vi.fn();

                await render(
                  <DirectionProvider direction={direction as TextDirection}>
                    <Tabs.Root
                      onValueChange={handleChange}
                      orientation={orientation as Tabs.Root.Props['orientation']}
                      value={2}
                    >
                      <Tabs.List onKeyDown={handleKeyDown} activateOnFocus>
                        <Tabs.Tab value={0} />
                        <Tabs.Tab value={1} />
                        <Tabs.Tab value={2} />
                      </Tabs.List>
                    </Tabs.Root>
                  </DirectionProvider>,
                );

                const [firstTab, , lastTab] = screen.getAllByRole('tab');
                await act(async () => {
                  lastTab.focus();
                });

                fireEvent.keyDown(lastTab, { key: nextItemKey });
                await flushMicrotasks();

                expect(firstTab).toHaveFocus();
                expect(handleChange.mock.calls.length).toBe(1);
                expect(handleChange.mock.calls[0][0]).toBe(0);
                expect(handleKeyDown.mock.calls.length).toBe(1);
                expect(handleKeyDown.mock.calls[0][0]).toHaveProperty('defaultPrevented', true);
              });

              it('moves focus to the next tab while activating it', async () => {
                const handleChange = vi.fn();
                const handleKeyDown = vi.fn();

                await render(
                  <DirectionProvider direction={direction as TextDirection}>
                    <Tabs.Root
                      onValueChange={handleChange}
                      orientation={orientation as Tabs.Root.Props['orientation']}
                      value={1}
                    >
                      <Tabs.List onKeyDown={handleKeyDown} activateOnFocus>
                        <Tabs.Tab value={0} />
                        <Tabs.Tab value={1} />
                        <Tabs.Tab value={2} />
                      </Tabs.List>
                    </Tabs.Root>
                  </DirectionProvider>,
                );

                const [, secondTab, lastTab] = screen.getAllByRole('tab');
                await act(async () => {
                  secondTab.focus();
                });

                fireEvent.keyDown(secondTab, { key: nextItemKey });
                await flushMicrotasks();

                expect(lastTab).toHaveFocus();
                expect(handleChange.mock.calls.length).toBe(1);
                expect(handleChange.mock.calls[0][0]).toBe(2);
                expect(handleKeyDown.mock.calls.length).toBe(1);
                expect(handleKeyDown.mock.calls[0][0]).toHaveProperty('defaultPrevented', true);
              });
            });

            it('moves focus to a disabled tab without activating it', async () => {
              const handleChange = vi.fn();
              const handleKeyDown = vi.fn();

              await render(
                <DirectionProvider direction={direction as TextDirection}>
                  <Tabs.Root
                    onValueChange={handleChange}
                    orientation={orientation as Tabs.Root.Props['orientation']}
                    value={0}
                  >
                    <Tabs.List onKeyDown={handleKeyDown}>
                      <Tabs.Tab value={0} />
                      <Tabs.Tab value={1} disabled />
                      <Tabs.Tab value={2} />
                    </Tabs.List>
                  </Tabs.Root>
                </DirectionProvider>,
              );

              const [firstTab, disabledTab, thirdTab] = screen.getAllByRole('tab');
              await act(async () => {
                firstTab.focus();
              });

              fireEvent.keyDown(firstTab, { key: nextItemKey });
              await flushMicrotasks();

              expect(disabledTab).toHaveFocus();
              expect(handleChange.mock.calls.length).toBe(0);
              expect(handleKeyDown.mock.calls.length).toBe(1);
              expect(handleKeyDown.mock.calls[0][0]).toHaveProperty('defaultPrevented', true);

              fireEvent.keyDown(disabledTab, { key: nextItemKey });
              await flushMicrotasks();
              expect(thirdTab).toHaveFocus();
            });
          });

          describe('modifier keys', () => {
            ['Shift', 'Control', 'Alt', 'Meta'].forEach((modifierKey) => {
              it(`does not move focus when modifier key: ${modifierKey} is pressed`, async () => {
                const handleChange = vi.fn();
                const handleKeyDown = vi.fn();
                const { user } = await render(
                  <DirectionProvider direction={direction as TextDirection}>
                    <Tabs.Root
                      onValueChange={handleChange}
                      orientation={orientation as Tabs.Root.Props['orientation']}
                      value={0}
                    >
                      <Tabs.List onKeyDown={handleKeyDown}>
                        <Tabs.Tab value={0} />
                        <Tabs.Tab value={1} />
                        <Tabs.Tab value={2} />
                      </Tabs.List>
                    </Tabs.Root>
                  </DirectionProvider>,
                );

                const [firstTab] = screen.getAllByRole('tab');

                await user.keyboard('[Tab]');
                expect(firstTab).toHaveFocus();

                await user.keyboard(`{${modifierKey}>}{${nextItemKey}}`);
                expect(firstTab).toHaveFocus();
                expect(handleChange.mock.calls.length).toBe(0);
                expect(handleKeyDown.mock.calls.length).toBe(2);

                await user.keyboard(`{${modifierKey}>}{${previousItemKey}}`);
                expect(firstTab).toHaveFocus();
                expect(handleChange.mock.calls.length).toBe(0);
                expect(handleKeyDown.mock.calls.length).toBe(4);
              });
            });
          });
        },
      );
    });

    describe('when focus is on a tab regardless of orientation', () => {
      describe('Home', () => {
        it('when `activateOnFocus = false`, moves focus to the first tab without activating it', async () => {
          const handleChange = vi.fn();
          const handleKeyDown = vi.fn();

          await render(
            <Tabs.Root onValueChange={handleChange} value={2}>
              <Tabs.List activateOnFocus={false} onKeyDown={handleKeyDown}>
                <Tabs.Tab value={0} />
                <Tabs.Tab value={1} />
                <Tabs.Tab value={2} />
              </Tabs.List>
            </Tabs.Root>,
          );

          const [firstTab, , lastTab] = screen.getAllByRole('tab');
          await act(async () => {
            lastTab.focus();
          });

          fireEvent.keyDown(lastTab, { key: 'Home' });
          await flushMicrotasks();

          expect(firstTab).toHaveFocus();
          expect(handleChange.mock.calls.length).toBe(0);
          expect(handleKeyDown.mock.calls.length).toBe(1);
          expect(handleKeyDown.mock.calls[0][0]).toHaveProperty('defaultPrevented', true);
        });

        it('when `activateOnFocus = true`, moves focus to the first tab while activating it', async () => {
          const handleChange = vi.fn();
          const handleKeyDown = vi.fn();

          await render(
            <Tabs.Root onValueChange={handleChange} value={2}>
              <Tabs.List onKeyDown={handleKeyDown} activateOnFocus>
                <Tabs.Tab value={0} />
                <Tabs.Tab value={1} />
                <Tabs.Tab value={2} />
              </Tabs.List>
            </Tabs.Root>,
          );

          const [firstTab, , lastTab] = screen.getAllByRole('tab');
          await act(async () => {
            lastTab.focus();
          });

          fireEvent.keyDown(lastTab, { key: 'Home' });
          await flushMicrotasks();

          expect(firstTab).toHaveFocus();
          expect(handleChange.mock.calls.length).toBe(1);
          expect(handleChange.mock.calls[0][0]).toBe(0);
          expect(handleKeyDown.mock.calls.length).toBe(1);
          expect(handleKeyDown.mock.calls[0][0]).toHaveProperty('defaultPrevented', true);
        });

        [false, true].forEach((activateOnFocusProp) => {
          it(`when \`activateOnFocus = ${activateOnFocusProp}\`, moves focus to a disabled tab without activating it`, async () => {
            const handleChange = vi.fn();
            const handleKeyDown = vi.fn();

            await render(
              <Tabs.Root onValueChange={handleChange} value={2}>
                <Tabs.List activateOnFocus={activateOnFocusProp} onKeyDown={handleKeyDown}>
                  <Tabs.Tab value={0} disabled />
                  <Tabs.Tab value={1} />
                  <Tabs.Tab value={2} />
                </Tabs.List>
              </Tabs.Root>,
            );

            const [disabledTab, , lastTab] = screen.getAllByRole('tab');
            await act(async () => {
              lastTab.focus();
            });

            fireEvent.keyDown(lastTab, { key: 'Home' });
            await flushMicrotasks();

            expect(disabledTab).toHaveFocus();
            expect(handleChange.mock.calls.length).toBe(0);
            expect(handleKeyDown.mock.calls.length).toBe(1);
            expect(handleKeyDown.mock.calls[0][0]).toHaveProperty('defaultPrevented', true);
          });
        });
      });

      describe('End', () => {
        it('when `activateOnFocus = false`, moves focus to the last tab without activating it', async () => {
          const handleChange = vi.fn();
          const handleKeyDown = vi.fn();

          await render(
            <Tabs.Root onValueChange={handleChange} value={0}>
              <Tabs.List activateOnFocus={false} onKeyDown={handleKeyDown}>
                <Tabs.Tab value={0} />
                <Tabs.Tab value={1} />
                <Tabs.Tab value={2} />
              </Tabs.List>
            </Tabs.Root>,
          );

          const [firstTab, , lastTab] = screen.getAllByRole('tab');
          await act(async () => {
            firstTab.focus();
          });

          fireEvent.keyDown(firstTab, { key: 'End' });
          await flushMicrotasks();

          expect(lastTab).toHaveFocus();
          expect(handleChange.mock.calls.length).toBe(0);
          expect(handleKeyDown.mock.calls.length).toBe(1);
          expect(handleKeyDown.mock.calls[0][0]).toHaveProperty('defaultPrevented', true);
        });

        it('when `activateOnFocus = true`, moves focus to the last tab while activating it', async () => {
          const handleChange = vi.fn();
          const handleKeyDown = vi.fn();

          await render(
            <Tabs.Root onValueChange={handleChange} value={0}>
              <Tabs.List onKeyDown={handleKeyDown} activateOnFocus>
                <Tabs.Tab value={0} />
                <Tabs.Tab value={1} />
                <Tabs.Tab value={2} />
              </Tabs.List>
            </Tabs.Root>,
          );

          const [firstTab, , lastTab] = screen.getAllByRole('tab');
          await act(async () => {
            firstTab.focus();
          });

          fireEvent.keyDown(firstTab, { key: 'End' });
          await flushMicrotasks();

          expect(lastTab).toHaveFocus();
          expect(handleChange.mock.calls.length).toBe(1);
          expect(handleChange.mock.calls[0][0]).toBe(2);
          expect(handleKeyDown.mock.calls.length).toBe(1);
          expect(handleKeyDown.mock.calls[0][0]).toHaveProperty('defaultPrevented', true);
        });

        [false, true].forEach((activateOnFocusProp) => {
          it(`when \`activateOnFocus = ${activateOnFocusProp}\`, moves focus to a disabled tab without activating it`, async () => {
            const handleChange = vi.fn();
            const handleKeyDown = vi.fn();

            await render(
              <Tabs.Root onValueChange={handleChange} value={0}>
                <Tabs.List activateOnFocus={activateOnFocusProp} onKeyDown={handleKeyDown}>
                  <Tabs.Tab value={0} />
                  <Tabs.Tab value={1} />
                  <Tabs.Tab value={2} disabled />
                </Tabs.List>
              </Tabs.Root>,
            );

            const [firstTab, , disabledTab] = screen.getAllByRole('tab');
            await act(async () => {
              firstTab.focus();
            });

            fireEvent.keyDown(firstTab, { key: 'End' });
            await flushMicrotasks();

            expect(disabledTab).toHaveFocus();
            expect(handleChange.mock.calls.length).toBe(0);
            expect(handleKeyDown.mock.calls.length).toBe(1);
            expect(handleKeyDown.mock.calls[0][0]).toHaveProperty('defaultPrevented', true);
          });
        });
      });
    });

    it('should allow to focus first tab when there are no active tabs', async () => {
      await render(
        <Tabs.Root defaultValue={0}>
          <Tabs.List>
            <Tabs.Tab value={0} />
            <Tabs.Tab value={1} />
          </Tabs.List>
        </Tabs.Root>,
      );

      expect(screen.getAllByRole('tab').map((tab) => tab.getAttribute('tabIndex'))).toEqual([
        '0',
        '-1',
      ]);
    });
  });

  describe.skipIf(isJSDOM)('activation direction', () => {
    function waitForAnimationFrame() {
      return new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          resolve();
        });
      });
    }

    async function waitForSettledPanelTransitions() {
      await act(async () => {
        await flushMicrotasks();
        // One frame lets panel transition work scheduled during the click settle,
        // and the second frame lets any resulting React update commit before the
        // next click assertion starts observing new render calls.
        await waitForAnimationFrame();
        await waitForAnimationFrame();
      });
    }

    function getFirstPanelRenderStateByValue(
      panelRenderMock: ReturnType<typeof vi.fn>,
      value: any,
    ) {
      return panelRenderMock.mock.calls.find(([state]) => state.value === value)?.[0];
    }

    it('should set the `data-activation-direction` attribute on the tabs root with orientation=horizontal', async () => {
      const panelRenderMock = vi.fn();
      const { user } = await render(
        <Tabs.Root data-testid="root">
          <Tabs.List>
            <Tabs.Tab value={0} />
            <Tabs.Tab value={1} />
          </Tabs.List>
          <Tabs.Panel value={0} render={(_, state) => panelRenderMock({ value: 0, ...state })} />
          <Tabs.Panel value={1} render={(_, state) => panelRenderMock({ value: 1, ...state })} />
        </Tabs.Root>,
      );

      // clear the initial render calls from mounting the component
      panelRenderMock.mockClear();

      const root = screen.getByTestId('root');
      const [tab1, tab2] = screen.getAllByRole('tab');

      expect(root).toHaveAttribute('data-activation-direction', 'none');
      await user.click(tab2);

      expect(getFirstPanelRenderStateByValue(panelRenderMock, 1)).toEqual(
        expect.objectContaining({ value: 1, tabActivationDirection: 'right' }),
      );
      expect(root).toHaveAttribute('data-activation-direction', 'right');

      await waitForSettledPanelTransitions();
      panelRenderMock.mockClear();

      await user.click(tab1);

      expect(getFirstPanelRenderStateByValue(panelRenderMock, 0)).toEqual(
        expect.objectContaining({ value: 0, tabActivationDirection: 'left' }),
      );
      expect(root).toHaveAttribute('data-activation-direction', 'left');
    });

    it('should set the `data-activation-direction` attribute on the tabs root with orientation=vertical', async () => {
      const panelRenderMock = vi.fn();
      const { user } = await render(
        <Tabs.Root data-testid="root" orientation="vertical">
          <Tabs.List>
            <Tabs.Tab value={0} style={{ display: 'block' }} />
            <Tabs.Tab value={1} style={{ display: 'block' }} />
          </Tabs.List>
          <Tabs.Panel value={0} render={(_, state) => panelRenderMock({ value: 0, ...state })} />
          <Tabs.Panel value={1} render={(_, state) => panelRenderMock({ value: 1, ...state })} />
        </Tabs.Root>,
      );

      // clear the initial render calls from mounting the component
      panelRenderMock.mockClear();

      const root = screen.getByTestId('root');
      const [tab1, tab2] = screen.getAllByRole('tab');

      expect(root).toHaveAttribute('data-activation-direction', 'none');
      await user.click(tab2);

      expect(getFirstPanelRenderStateByValue(panelRenderMock, 1)).toEqual(
        expect.objectContaining({ value: 1, tabActivationDirection: 'down' }),
      );
      expect(root).toHaveAttribute('data-activation-direction', 'down');

      await waitForSettledPanelTransitions();
      panelRenderMock.mockClear();

      await user.click(tab1);

      expect(getFirstPanelRenderStateByValue(panelRenderMock, 0)).toEqual(
        expect.objectContaining({ value: 0, tabActivationDirection: 'up' }),
      );
      expect(root).toHaveAttribute('data-activation-direction', 'up');
    });

    it('should update `data-activation-direction` on programmatic value changes with orientation=horizontal', async () => {
      const panelRenderMock = vi.fn();
      const { setProps } = await render(
        <Tabs.Root data-testid="root" value={0}>
          <Tabs.List>
            <Tabs.Tab value={0} />
            <Tabs.Tab value={1} />
          </Tabs.List>
          <Tabs.Panel value={0} render={(_, state) => panelRenderMock({ value: 0, ...state })} />
          <Tabs.Panel value={1} render={(_, state) => panelRenderMock({ value: 1, ...state })} />
        </Tabs.Root>,
      );

      // clear the initial render calls from mounting the component
      panelRenderMock.mockClear();

      const root = screen.getByTestId('root');
      const tabs = screen.getAllByRole('tab');
      expect(root).toHaveAttribute('data-activation-direction', 'none');
      expect(tabs[0]).toHaveAttribute('data-activation-direction', 'none');

      await setProps({ value: 1 });

      expect(getFirstPanelRenderStateByValue(panelRenderMock, 1)).toEqual(
        expect.objectContaining({ value: 1, tabActivationDirection: 'right' }),
      );
      expect(root).toHaveAttribute('data-activation-direction', 'right');
      expect(tabs[1]).toHaveAttribute('data-activation-direction', 'right');

      panelRenderMock.mockClear();

      await setProps({ value: 0 });

      expect(getFirstPanelRenderStateByValue(panelRenderMock, 0)).toEqual(
        expect.objectContaining({ value: 0, tabActivationDirection: 'left' }),
      );
      expect(root).toHaveAttribute('data-activation-direction', 'left');
      expect(tabs[0]).toHaveAttribute('data-activation-direction', 'left');
    });

    it('should update `data-activation-direction` on programmatic value changes with orientation=vertical', async () => {
      const panelRenderMock = vi.fn();
      const { setProps } = await render(
        <Tabs.Root data-testid="root" value={0} orientation="vertical">
          <Tabs.List>
            <Tabs.Tab value={0} style={{ display: 'block' }} />
            <Tabs.Tab value={1} style={{ display: 'block' }} />
          </Tabs.List>
          <Tabs.Panel value={0} render={(_, state) => panelRenderMock({ value: 0, ...state })} />
          <Tabs.Panel value={1} render={(_, state) => panelRenderMock({ value: 1, ...state })} />
        </Tabs.Root>,
      );

      // clear the initial render calls from mounting the component
      panelRenderMock.mockClear();

      const root = screen.getByTestId('root');
      const tabs = screen.getAllByRole('tab');
      expect(root).toHaveAttribute('data-activation-direction', 'none');
      expect(tabs[0]).toHaveAttribute('data-activation-direction', 'none');

      await setProps({ value: 1 });

      expect(getFirstPanelRenderStateByValue(panelRenderMock, 1)).toEqual(
        expect.objectContaining({ value: 1, tabActivationDirection: 'down' }),
      );
      expect(root).toHaveAttribute('data-activation-direction', 'down');
      expect(tabs[1]).toHaveAttribute('data-activation-direction', 'down');

      panelRenderMock.mockClear();

      await setProps({ value: 0 });

      expect(getFirstPanelRenderStateByValue(panelRenderMock, 0)).toEqual(
        expect.objectContaining({ value: 0, tabActivationDirection: 'up' }),
      );
      expect(root).toHaveAttribute('data-activation-direction', 'up');
      expect(tabs[0]).toHaveAttribute('data-activation-direction', 'up');
    });

    it('keeps activation direction none after automatic disabled fallback', async () => {
      function TestComponent({ disableFirst }: { disableFirst: boolean }) {
        return (
          <Tabs.Root data-testid="root" defaultValue={0}>
            <Tabs.List>
              <Tabs.Tab value={0} disabled={disableFirst}>
                Tab 0
              </Tabs.Tab>
              <Tabs.Tab value={1}>Tab 1</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value={0}>Panel 0</Tabs.Panel>
            <Tabs.Panel value={1}>Panel 1</Tabs.Panel>
          </Tabs.Root>
        );
      }

      const { setProps } = await render(<TestComponent disableFirst={false} />);

      await setProps({ disableFirst: true });

      await waitFor(() => {
        expect(screen.getAllByRole('tab')[1]).toHaveAttribute('aria-selected', 'true');
      });
      expect(screen.getByTestId('root')).toHaveAttribute('data-activation-direction', 'none');
    });

    it('should update `data-activation-direction` on programmatic change after a canceled click', async () => {
      const { user, setProps } = await render(
        <Tabs.Root
          data-testid="root"
          value={0}
          onValueChange={(_value, eventDetails) => {
            eventDetails.cancel();
          }}
        >
          <Tabs.List>
            <Tabs.Tab value={0} />
            <Tabs.Tab value={1} />
          </Tabs.List>
          <Tabs.Panel value={0} />
          <Tabs.Panel value={1} />
        </Tabs.Root>,
      );

      const root = screen.getByTestId('root');
      const [, tab2] = screen.getAllByRole('tab');

      // Click is canceled — value stays at 0
      await user.click(tab2);
      expect(root).toHaveAttribute('data-activation-direction', 'none');

      // A later programmatic change should still compute direction correctly
      await setProps({ value: 1 });

      expect(root).toHaveAttribute('data-activation-direction', 'right');
    });

    it('should update `data-activation-direction` on programmatic change after a controlled parent ignores click', async () => {
      const { user, setProps } = await render(
        <Tabs.Root data-testid="root" value={0} onValueChange={() => {}}>
          <Tabs.List>
            <Tabs.Tab value={0} />
            <Tabs.Tab value={1} />
          </Tabs.List>
          <Tabs.Panel value={0} />
          <Tabs.Panel value={1} />
        </Tabs.Root>,
      );

      const root = screen.getByTestId('root');
      const [, tab2] = screen.getAllByRole('tab');

      // Click fires onValueChange but parent doesn't update value
      await user.click(tab2);

      // A later programmatic change should still compute direction correctly
      await setProps({ value: 1 });

      expect(root).toHaveAttribute('data-activation-direction', 'right');
    });

    it('should compute correct direction when adding and selecting a new tab in one controlled update', async () => {
      const panelRenderMock = vi.fn();
      function DynamicTabs() {
        const [tabs, setTabs] = React.useState([0, 1]);
        const [value, setValue] = React.useState(0);

        return (
          <div>
            <button
              type="button"
              onClick={() => {
                setTabs([0, 1, 2]);
                setValue(2);
              }}
            >
              Add and Select
            </button>
            <Tabs.Root data-testid="root" value={value}>
              <Tabs.List>
                {tabs.map((tab) => (
                  <Tabs.Tab key={tab} value={tab} />
                ))}
              </Tabs.List>
              {tabs.map((tab) => (
                <Tabs.Panel
                  key={tab}
                  value={tab}
                  render={(_, state) => panelRenderMock({ value: tab, ...state })}
                />
              ))}
            </Tabs.Root>
          </div>
        );
      }

      const { user } = await render(<DynamicTabs />);

      // clear the initial render calls from mounting the component
      panelRenderMock.mockClear();

      const root = screen.getByTestId('root');
      expect(root).toHaveAttribute('data-activation-direction', 'none');

      await user.click(screen.getByText('Add and Select'));

      expect(panelRenderMock.mock.calls.find(([state]) => state.value === 2)?.[0]).toEqual(
        expect.objectContaining({ value: 2, tabActivationDirection: 'right' }),
      );
      expect(root).toHaveAttribute('data-activation-direction', 'right');
    });

    it('should compute correct direction on final render when adding and selecting a new tab in one controlled update with out of order string values', async () => {
      const panelRenderMock = vi.fn();
      function DynamicTabs() {
        const [tabs, setTabs] = React.useState(['Overview', 'Projects']);
        const [value, setValue] = React.useState('Overview');

        return (
          <div>
            <button
              type="button"
              onClick={() => {
                setTabs(['Overview', 'Projects', 'Account']);
                setValue('Account');
              }}
            >
              Add and Select
            </button>
            <Tabs.Root data-testid="root" value={value}>
              <Tabs.List>
                {tabs.map((tab) => (
                  <Tabs.Tab key={tab} value={tab} />
                ))}
              </Tabs.List>
              {tabs.map((tab) => (
                <Tabs.Panel key={tab} value={tab} render={(_, state) => panelRenderMock(state)} />
              ))}
            </Tabs.Root>
          </div>
        );
      }

      const { user } = await render(<DynamicTabs />);

      // clear the initial render calls from mounting the component
      panelRenderMock.mockClear();

      const root = screen.getByTestId('root');
      expect(root).toHaveAttribute('data-activation-direction', 'none');

      await user.click(screen.getByText('Add and Select'));

      expect(panelRenderMock).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ tabActivationDirection: 'left' }),
      );
      expect(panelRenderMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ tabActivationDirection: 'right' }),
      );
      expect(root).toHaveAttribute('data-activation-direction', 'right');
    });
  });

  describe('popups', () => {
    it('works inside Popover', async () => {
      function ExamplePopover() {
        return (
          <Popover.Root>
            <Popover.Trigger>Open</Popover.Trigger>
            <Popover.Portal>
              <Popover.Positioner sideOffset={8}>
                <Popover.Popup>
                  <Tabs.Root defaultValue="overview">
                    <Tabs.List>
                      <Tabs.Tab value="overview">Overview</Tabs.Tab>
                      <Tabs.Tab value="projects">Projects</Tabs.Tab>
                      <Tabs.Tab value="account">Account</Tabs.Tab>
                    </Tabs.List>
                    <Tabs.Panel value="overview" />
                    <Tabs.Panel value="projects" />
                    <Tabs.Panel value="account" />
                  </Tabs.Root>
                </Popover.Popup>
              </Popover.Positioner>
            </Popover.Portal>
          </Popover.Root>
        );
      }

      const { user } = await render(<ExamplePopover />);

      const trigger = screen.getByRole('button', { name: 'Open' });

      await user.click(trigger);

      const tab1 = screen.getByRole('tab', { name: 'Overview' });
      await waitFor(() => {
        expect(tab1).toHaveFocus();
      });

      await user.keyboard('{ArrowRight}');

      const tab2 = screen.getByRole('tab', { name: 'Projects' });
      await waitFor(() => {
        expect(tab2).toHaveFocus();
      });
    });

    it('works inside Dialog', async () => {
      function ExampleDialog() {
        return (
          <Dialog.Root>
            <Dialog.Trigger>Open</Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Popup>
                <Tabs.Root defaultValue="overview">
                  <Tabs.List>
                    <Tabs.Tab value="overview">Overview</Tabs.Tab>
                    <Tabs.Tab value="projects">Projects</Tabs.Tab>
                    <Tabs.Tab value="account">Account</Tabs.Tab>
                  </Tabs.List>
                  <Tabs.Panel value="overview" />
                  <Tabs.Panel value="projects" />
                  <Tabs.Panel value="account" />
                </Tabs.Root>
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
        );
      }

      const { user } = await render(<ExampleDialog />);

      const trigger = screen.getByRole('button', { name: 'Open' });

      await user.click(trigger);

      const tab1 = screen.getByRole('tab', { name: 'Overview' });
      await waitFor(() => {
        expect(tab1).toHaveFocus();
      });
      await user.keyboard('{ArrowRight}');

      const tab2 = screen.getByRole('tab', { name: 'Projects' });
      await waitFor(() => {
        expect(tab2).toHaveFocus();
      });
    });
  });

  describe('highlight synchronization on external value change relative to focus', () => {
    it('when focus is outside the tablist, highlight follows the new active tab (tabIndex=0 moves)', async () => {
      const { setProps } = await render(
        <Tabs.Root value={0}>
          <Tabs.List activateOnFocus={false}>
            <Tabs.Tab value={0} />
            <Tabs.Tab value={1} />
            <Tabs.Tab value={2} />
          </Tabs.List>
        </Tabs.Root>,
      );

      const [firstTab, secondTab, thirdTab] = screen.getAllByRole('tab');

      expect(firstTab.tabIndex).toBe(0);

      await setProps({ value: 2 });
      await flushMicrotasks();

      expect(firstTab.tabIndex).toBe(-1);
      expect(secondTab.tabIndex).toBe(-1);
      expect(thirdTab.tabIndex).toBe(0);

      await setProps({ value: 1 });
      await flushMicrotasks();

      expect(firstTab.tabIndex).toBe(-1);
      expect(secondTab.tabIndex).toBe(0);
      expect(thirdTab.tabIndex).toBe(-1);
    });

    it('when focus is inside the tablist, highlight stays put on external change and arrow keys continue from the focused tab', async () => {
      const { setProps } = await render(
        <Tabs.Root value={0}>
          <Tabs.List activateOnFocus={false}>
            <Tabs.Tab value={0}>Tab 1</Tabs.Tab>
            <Tabs.Tab value={1}>Tab 2</Tabs.Tab>
            <Tabs.Tab value={2}>Tab 3</Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>,
      );

      const [firstTab, secondTab, thirdTab] = screen.getAllByRole('tab');

      await act(async () => {
        firstTab.focus();
      });
      expect(firstTab).toHaveProperty('tabIndex', 0);

      await setProps({ value: 2 });
      await flushMicrotasks();

      // Highlight should not change (still on first tab), but selection did
      expect(firstTab.tabIndex).toBe(0);
      expect(secondTab.tabIndex).toBe(-1);
      expect(thirdTab.tabIndex).toBe(-1);
      expect(firstTab).toHaveAttribute('aria-selected', 'false');
      expect(thirdTab).toHaveAttribute('aria-selected', 'true');

      // Arrow navigation should continue from the highlighted tab
      fireEvent.keyDown(firstTab, { key: 'ArrowRight' });
      await flushMicrotasks();

      expect(secondTab).toHaveFocus();
      // Selection remains the externally-set tab since activateOnFocus=false
      expect(thirdTab).toHaveAttribute('aria-selected', 'true');
      expect(secondTab).toHaveAttribute('aria-selected', 'false');
    });
  });
});
