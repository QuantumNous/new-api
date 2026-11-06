import { expect } from 'vitest';
import { reactMajor, screen, waitFor } from '@mui/internal-test-utils';
import * as React from 'react';
import { Accordion } from '@base-ui/react/accordion';
import { createRenderer, describeConformance, isJSDOM } from '#test-utils';

const PANEL_CONTENT = 'This is panel content';

describe('<Accordion.Panel />', () => {
  const { render, renderToString } = createRenderer();

  function getActivity() {
    type ActivityProps = {
      mode: 'visible' | 'hidden';
      children: React.ReactNode;
    };

    return (React as typeof React & { Activity: React.ComponentType<ActivityProps> }).Activity;
  }

  describeConformance(<Accordion.Panel keepMounted />, () => ({
    render: (node) =>
      render(
        <Accordion.Root>
          <Accordion.Item>{node}</Accordion.Item>
        </Accordion.Root>,
      ),
    refInstanceof: window.HTMLDivElement,
  }));

  describe('server-side rendering', () => {
    it('suppresses the initial keyframe animation from inline styles when rendered open', async () => {
      await renderToString(
        <React.Fragment>
          <style>{`
            @keyframes panel-slide-down {
              from {
                height: 0;
              }

              to {
                height: var(--accordion-panel-height);
              }
            }
          `}</style>

          <Accordion.Root defaultValue={[0]}>
            <Accordion.Item value={0}>
              <Accordion.Header>
                <Accordion.Trigger>Trigger</Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Panel
                data-testid="panel"
                style={{
                  animationDuration: '100ms',
                  animationName: 'panel-slide-down',
                  animationTimingFunction: 'linear',
                }}
              >
                {PANEL_CONTENT}
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion.Root>
        </React.Fragment>,
      );

      const panel = screen.getByTestId('panel');

      expect(panel.style.animationName).toBe('none');
      expect(panel.style.animationDuration).toBe('100ms');
    });
  });

  it('passes root keepMounted to closed panels', async () => {
    await render(
      <Accordion.Root keepMounted>
        <Accordion.Item value={0}>
          <Accordion.Header>
            <Accordion.Trigger>Trigger</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel>{PANEL_CONTENT}</Accordion.Panel>
        </Accordion.Item>
      </Accordion.Root>,
    );

    expect(screen.getByText(PANEL_CONTENT)).toHaveAttribute('hidden');
  });

  it('passes root hiddenUntilFound to closed panels and allows panel overrides', async () => {
    await render(
      <Accordion.Root hiddenUntilFound keepMounted>
        <Accordion.Item value={0}>
          <Accordion.Header>
            <Accordion.Trigger>Trigger 1</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel>{PANEL_CONTENT}</Accordion.Panel>
        </Accordion.Item>
        <Accordion.Item value={1}>
          <Accordion.Header>
            <Accordion.Trigger>Trigger 2</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel hiddenUntilFound={false} keepMounted={false}>
            Overridden panel
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion.Root>,
    );

    expect(screen.getByText(PANEL_CONTENT).getAttribute('hidden')).toBe('until-found');
    expect(screen.queryByText('Overridden panel')).toBe(null);
  });

  describe.skipIf(isJSDOM)('CSS transitions', () => {
    it('keeps the closing panel visible until its exit transition completes when switching items', async () => {
      const { user } = await render(
        <React.Fragment>
          <style>{`
            .transition-test-panel {
              overflow: hidden;
              height: var(--accordion-panel-height);
              transition: height 300ms linear;
            }

            .transition-test-panel[data-starting-style],
            .transition-test-panel[data-ending-style] {
              height: 0;
            }
          `}</style>

          <Accordion.Root defaultValue={[0]} multiple={false}>
            <Accordion.Item value={0}>
              <Accordion.Header>
                <Accordion.Trigger>Trigger 1</Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Panel className="transition-test-panel" data-testid="panel-1" keepMounted>
                First panel
              </Accordion.Panel>
            </Accordion.Item>

            <Accordion.Item value={1}>
              <Accordion.Header>
                <Accordion.Trigger>Trigger 2</Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Panel className="transition-test-panel" data-testid="panel-2" keepMounted>
                Second panel
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion.Root>
        </React.Fragment>,
      );

      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });
      const panel1 = screen.getByTestId('panel-1');
      const panel2 = screen.getByTestId('panel-2');

      await waitFor(() => {
        expect(panel1).toHaveAttribute('data-open');
        expect(panel1.style.getPropertyValue('--accordion-panel-height')).toBe('auto');
      });

      await user.click(trigger2);

      await waitFor(() => {
        expect(panel1).toHaveAttribute('data-ending-style');
        expect(panel1).not.toHaveAttribute('hidden');
        expect(panel1.style.getPropertyValue('--accordion-panel-height')).toMatch(/px$/);
        expect(panel2).toHaveAttribute('data-open');
      });

      await waitFor(() => {
        expect(panel1).toHaveAttribute('hidden');
        expect(panel2).not.toHaveAttribute('hidden');
      });
    });
  });

  describe.skipIf(isJSDOM || reactMajor < 19)('React.Activity', () => {
    it('does not replay open keyframe animations from inline styles when revealing a panel opened by the user', async () => {
      const Activity = getActivity();

      function App() {
        const [visible, setVisible] = React.useState(true);

        return (
          <React.Fragment>
            <style>{`
              @keyframes panel-slide-down {
                from {
                  height: 0;
                }

                to {
                  height: var(--accordion-panel-height);
                }
              }
            `}</style>

            <button type="button" onClick={() => setVisible((prev) => !prev)}>
              toggle activity
            </button>

            <Activity mode={visible ? 'visible' : 'hidden'}>
              <Accordion.Root>
                <Accordion.Item value={0}>
                  <Accordion.Header>
                    <Accordion.Trigger>Trigger</Accordion.Trigger>
                  </Accordion.Header>
                  <Accordion.Panel
                    data-testid="panel"
                    keepMounted
                    style={{
                      animationDuration: '100ms',
                      animationName: 'panel-slide-down',
                      animationTimingFunction: 'linear',
                      overflow: 'hidden',
                    }}
                  >
                    {PANEL_CONTENT}
                  </Accordion.Panel>
                </Accordion.Item>
              </Accordion.Root>
            </Activity>
          </React.Fragment>
        );
      }

      const { user } = await render(<App />);

      const toggle = screen.getByRole('button', { name: 'toggle activity' });
      const trigger = screen.getByRole('button', { name: 'Trigger' });
      const panel = screen.getByTestId('panel');

      await user.click(trigger);

      await waitFor(() => {
        expect(panel).toHaveAttribute('data-open');
      });

      await waitFor(() => {
        expect(panel.getAnimations().length).toBe(0);
      });

      await user.click(toggle);
      await user.click(toggle);

      await waitFor(() => {
        expect(panel).toHaveAttribute('data-open');
      });

      expect(panel.getAnimations().length).toBe(0);
    });
  });
});
