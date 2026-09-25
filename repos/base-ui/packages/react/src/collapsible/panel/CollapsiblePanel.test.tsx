import { expect, vi } from 'vitest';
import * as React from 'react';
import {
  act,
  fireEvent,
  flushMicrotasks,
  reactMajor,
  screen,
  waitFor,
} from '@mui/internal-test-utils';
import { Collapsible } from '@base-ui/react/collapsible';
import { createRenderer, describeConformance, isJSDOM } from '#test-utils';
import { REASONS } from '../../internals/reasons';

const PANEL_CONTENT = 'This is panel content';

function fireBeforeMatch(element: Element) {
  fireEvent(
    element,
    new window.Event('beforematch', {
      bubbles: true,
      cancelable: false,
    }),
  );
}

function waitForAnimationFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      resolve();
    });
  });
}

describe('<Collapsible.Panel />', () => {
  const { render, renderToString } = createRenderer();

  function getActivity() {
    type ActivityProps = {
      mode: 'visible' | 'hidden';
      children: React.ReactNode;
    };

    return (React as typeof React & { Activity: React.ComponentType<ActivityProps> }).Activity;
  }

  describeConformance(<Collapsible.Panel />, () => ({
    refInstanceof: window.HTMLDivElement,
    render: (node) => {
      return render(<Collapsible.Root defaultOpen>{node}</Collapsible.Root>);
    },
  }));

  describe('prop: keepMounted', () => {
    it('does not unmount the panel when true', async () => {
      function App() {
        const [open, setOpen] = React.useState(false);
        return (
          <Collapsible.Root open={open} onOpenChange={setOpen}>
            <Collapsible.Trigger />
            <Collapsible.Panel keepMounted>{PANEL_CONTENT}</Collapsible.Panel>
          </Collapsible.Root>
        );
      }

      await render(<App />);

      const trigger = screen.getByRole('button');

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText(PANEL_CONTENT)).not.toBe(null);
      expect(screen.queryByText(PANEL_CONTENT)).not.toBeVisible();
      expect(screen.queryByText(PANEL_CONTENT)).toHaveAttribute('data-closed');

      fireEvent.click(trigger);
      await flushMicrotasks();

      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(trigger.getAttribute('aria-controls')).toBe(
        screen.queryByText(PANEL_CONTENT)?.getAttribute('id'),
      );
      expect(screen.queryByText(PANEL_CONTENT)).toBeVisible();
      expect(screen.queryByText(PANEL_CONTENT)).toHaveAttribute('data-open');
      expect(trigger).toHaveAttribute('data-panel-open');

      fireEvent.click(trigger);
      await flushMicrotasks();

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(trigger.getAttribute('aria-controls')).toBe(null);
      expect(screen.queryByText(PANEL_CONTENT)).not.toBeVisible();
      expect(screen.queryByText(PANEL_CONTENT)).toHaveAttribute('data-closed');
    });

    it.skipIf(isJSDOM)(
      'hides the panel after external controlled close when true and no animations are applied',
      async () => {
        function App() {
          const [open, setOpen] = React.useState(false);

          return (
            <React.Fragment>
              <Collapsible.Root open={open} onOpenChange={setOpen}>
                <Collapsible.Trigger>Trigger</Collapsible.Trigger>
                <Collapsible.Panel keepMounted>{PANEL_CONTENT}</Collapsible.Panel>
              </Collapsible.Root>

              <button type="button" onClick={() => setOpen(!open)}>
                toggle externally
              </button>
            </React.Fragment>
          );
        }

        const { user } = await render(<App />);

        const trigger = screen.getByRole('button', { name: 'Trigger' });
        const externalTrigger = screen.getByRole('button', { name: 'toggle externally' });
        const panel = screen.getByText(PANEL_CONTENT);

        expect(trigger).toHaveAttribute('aria-expanded', 'false');
        expect(panel).toHaveAttribute('hidden');
        expect(panel).toHaveAttribute('data-closed');
        expect(panel).not.toHaveAttribute('data-ending-style');

        await user.click(externalTrigger);

        expect(trigger).toHaveAttribute('aria-expanded', 'true');
        expect(panel).not.toHaveAttribute('hidden');
        expect(panel).toHaveAttribute('data-open');

        await user.click(externalTrigger);

        expect(trigger).toHaveAttribute('aria-expanded', 'false');
        expect(panel).toHaveAttribute('hidden');
        expect(panel).toHaveAttribute('data-closed');
        expect(panel).not.toHaveAttribute('data-ending-style');
      },
    );
  });

  describe.skipIf(isJSDOM)('CSS transitions', () => {
    it('applies data-starting-style while opening', async () => {
      await render(
        <React.Fragment>
          <style>{`
            .transition-test-panel {
              overflow: hidden;
              height: var(--collapsible-panel-height);
              transition: height 100ms linear;
            }

            .transition-test-panel[data-starting-style],
            .transition-test-panel[data-ending-style] {
              height: 0;
            }
          `}</style>

          <Collapsible.Root>
            <Collapsible.Trigger>Trigger</Collapsible.Trigger>
            <Collapsible.Panel className="transition-test-panel" data-testid="panel">
              {PANEL_CONTENT}
            </Collapsible.Panel>
          </Collapsible.Root>
        </React.Fragment>,
      );

      const trigger = screen.getByRole('button', { name: 'Trigger' });

      // Keep this synchronous so the transient starting-style render is observable.
      fireEvent.click(trigger);

      const panel = screen.getByTestId('panel');

      expect(panel).toHaveAttribute('data-starting-style');
      expect(panel).toHaveAttribute('data-open');
    });

    it('restores a measured height before applying closing transition styles', async () => {
      const { user } = await render(
        <React.Fragment>
          <style>{`
            .transition-test-panel {
              overflow: hidden;
              height: var(--collapsible-panel-height);
              transition: height 100ms linear;
            }

            .transition-test-panel[data-ending-style] {
              height: 0;
            }
          `}</style>

          <Collapsible.Root defaultOpen>
            <Collapsible.Trigger>Trigger</Collapsible.Trigger>
            <Collapsible.Panel className="transition-test-panel" data-testid="panel">
              {PANEL_CONTENT}
            </Collapsible.Panel>
          </Collapsible.Root>
        </React.Fragment>,
      );

      const trigger = screen.getByRole('button', { name: 'Trigger' });
      const panel = screen.getByTestId('panel');

      await waitFor(() => {
        expect(panel.style.getPropertyValue('--collapsible-panel-height')).toBe('auto');
      });

      await user.click(trigger);

      await waitFor(() => {
        expect(panel).toHaveAttribute('data-ending-style');
        expect(panel.style.getPropertyValue('--collapsible-panel-height')).toMatch(/px$/);
      });
    });
  });

  describe.skipIf(isJSDOM)('CSS animations', () => {
    it('does not run the mount animation when initially open', async () => {
      await render(
        <React.Fragment>
          <style>{`
            @keyframes panel-slide-down {
              from {
                height: 0;
              }

              to {
                height: var(--collapsible-panel-height);
              }
            }

            .animation-test-panel[data-open] {
              overflow: hidden;
              animation: panel-slide-down 100ms linear;
            }
          `}</style>

          <Collapsible.Root defaultOpen>
            <Collapsible.Trigger>Trigger</Collapsible.Trigger>
            <Collapsible.Panel className="animation-test-panel" data-testid="panel">
              {PANEL_CONTENT}
            </Collapsible.Panel>
          </Collapsible.Root>
        </React.Fragment>,
      );

      const panel = screen.getByTestId('panel');

      expect(panel).toHaveAttribute('data-open');
      expect(panel.getAnimations().length).toBe(0);
      expect(getComputedStyle(panel).animationName).toBe('none');
    });

    it('still animates on close and reopen after being initially open', async () => {
      const { user } = await render(
        <React.Fragment>
          <style>{`
            @keyframes panel-slide-down {
              from {
                height: 0;
              }

              to {
                height: var(--collapsible-panel-height);
              }
            }

            @keyframes panel-slide-up {
              from {
                height: var(--collapsible-panel-height);
              }

              to {
                height: 0;
              }
            }

            .animation-test-panel[data-open] {
              overflow: hidden;
              animation: panel-slide-down 100ms linear;
            }

            .animation-test-panel[data-closed] {
              overflow: hidden;
              animation: panel-slide-up 100ms linear;
            }
          `}</style>

          <Collapsible.Root defaultOpen>
            <Collapsible.Trigger>Trigger</Collapsible.Trigger>
            <Collapsible.Panel className="animation-test-panel" data-testid="panel" keepMounted>
              {PANEL_CONTENT}
            </Collapsible.Panel>
          </Collapsible.Root>
        </React.Fragment>,
      );

      const trigger = screen.getByRole('button', { name: 'Trigger' });
      const panel = screen.getByTestId('panel');

      expect(panel.getAnimations().length).toBe(0);

      await user.click(trigger);

      await waitFor(() => {
        expect(panel).toHaveAttribute('data-closed');
        expect(panel.getAnimations().length).toBe(1);
      });

      await user.click(trigger);

      await waitFor(() => {
        expect(panel).toHaveAttribute('data-open');
        expect(panel.getAnimations().length).toBe(1);
      });
    });

    it('still animates on reopen after being initially open when only open keyframes are defined', async () => {
      const { user } = await render(
        <React.Fragment>
          <style>{`
            @keyframes panel-slide-down {
              from {
                height: 0;
              }

              to {
                height: var(--collapsible-panel-height);
              }
            }

            .animation-test-panel[data-open] {
              overflow: hidden;
              animation: panel-slide-down 100ms linear;
            }
          `}</style>

          <Collapsible.Root defaultOpen>
            <Collapsible.Trigger>Trigger</Collapsible.Trigger>
            <Collapsible.Panel className="animation-test-panel" data-testid="panel" keepMounted>
              {PANEL_CONTENT}
            </Collapsible.Panel>
          </Collapsible.Root>
        </React.Fragment>,
      );

      const trigger = screen.getByRole('button', { name: 'Trigger' });
      const panel = screen.getByTestId('panel');

      expect(panel.getAnimations().length).toBe(0);

      await user.click(trigger);

      await waitFor(() => {
        expect(panel).toHaveAttribute('data-closed');
      });

      await user.click(trigger);

      await waitFor(() => {
        expect(panel).toHaveAttribute('data-open');
        expect(panel.getAnimations().length).toBe(1);
      });
    });
  });

  describe('server-side rendering', () => {
    it('suppresses the initial keyframe animation when rendered open', async () => {
      await renderToString(
        <React.Fragment>
          <style>{`
            @keyframes panel-slide-down {
              from {
                height: 0;
              }

              to {
                height: var(--collapsible-panel-height);
              }
            }

            .animation-test-panel[data-open] {
              animation: panel-slide-down 100ms linear;
            }
          `}</style>

          <Collapsible.Root defaultOpen>
            <Collapsible.Trigger>Trigger</Collapsible.Trigger>
            <Collapsible.Panel className="animation-test-panel" data-testid="panel">
              {PANEL_CONTENT}
            </Collapsible.Panel>
          </Collapsible.Root>
        </React.Fragment>,
      );

      expect(screen.getByTestId('panel').style.animationName).toBe('none');
    });

    it('suppresses the initial keyframe animation from inline styles when rendered open', async () => {
      await renderToString(
        <React.Fragment>
          <style>{`
            @keyframes panel-slide-down {
              from {
                height: 0;
              }

              to {
                height: var(--collapsible-panel-height);
              }
            }
          `}</style>

          <Collapsible.Root defaultOpen>
            <Collapsible.Trigger>Trigger</Collapsible.Trigger>
            <Collapsible.Panel
              data-testid="panel"
              style={{
                animationDuration: '100ms',
                animationName: 'panel-slide-down',
                animationTimingFunction: 'linear',
              }}
            >
              {PANEL_CONTENT}
            </Collapsible.Panel>
          </Collapsible.Root>
        </React.Fragment>,
      );

      const panel = screen.getByTestId('panel');

      expect(panel.style.animationName).toBe('none');
      expect(panel.style.animationDuration).toBe('100ms');
    });
  });

  describe.skipIf(isJSDOM || reactMajor < 19)('React.Activity', () => {
    it('does not replay open transitions when revealing an initially open panel', async () => {
      const Activity = getActivity();

      function App() {
        const [visible, setVisible] = React.useState(true);

        return (
          <React.Fragment>
            <style>{`
              .transition-test-panel {
                overflow: hidden;
                height: var(--collapsible-panel-height);
                transition: height 100ms linear;
              }

              .transition-test-panel[data-starting-style],
              .transition-test-panel[data-ending-style] {
                height: 0;
              }
            `}</style>

            <button type="button" onClick={() => setVisible((prev) => !prev)}>
              toggle activity
            </button>

            <Activity mode={visible ? 'visible' : 'hidden'}>
              <Collapsible.Root defaultOpen>
                <Collapsible.Trigger>Trigger</Collapsible.Trigger>
                <Collapsible.Panel className="transition-test-panel" data-testid="panel">
                  {PANEL_CONTENT}
                </Collapsible.Panel>
              </Collapsible.Root>
            </Activity>
          </React.Fragment>
        );
      }

      const { user } = await render(<App />);

      const toggle = screen.getByRole('button', { name: 'toggle activity' });
      const panel = screen.getByTestId('panel');
      let transitionRuns = 0;

      panel.addEventListener('transitionrun', () => {
        transitionRuns += 1;
      });

      await waitFor(() => {
        expect(panel.style.getPropertyValue('--collapsible-panel-height')).toBe('auto');
      });

      transitionRuns = 0;

      await user.click(toggle);
      await user.click(toggle);

      await waitFor(() => {
        expect(panel).toHaveAttribute('data-open');
      });

      expect(transitionRuns).toBe(0);
    });

    it('does not replay open transitions when revealing a panel opened by the user', async () => {
      const Activity = getActivity();

      function App() {
        const [visible, setVisible] = React.useState(true);

        return (
          <React.Fragment>
            <style>{`
              .transition-test-panel {
                overflow: hidden;
                height: var(--collapsible-panel-height);
                transition: height 100ms linear;
              }

              .transition-test-panel[data-starting-style],
              .transition-test-panel[data-ending-style] {
                height: 0;
              }
            `}</style>

            <button type="button" onClick={() => setVisible((prev) => !prev)}>
              toggle activity
            </button>

            <Activity mode={visible ? 'visible' : 'hidden'}>
              <Collapsible.Root>
                <Collapsible.Trigger>Trigger</Collapsible.Trigger>
                <Collapsible.Panel
                  className="transition-test-panel"
                  data-testid="panel"
                  keepMounted
                >
                  {PANEL_CONTENT}
                </Collapsible.Panel>
              </Collapsible.Root>
            </Activity>
          </React.Fragment>
        );
      }

      const { user } = await render(<App />);

      const toggle = screen.getByRole('button', { name: 'toggle activity' });
      const trigger = screen.getByRole('button', { name: 'Trigger' });
      const panel = screen.getByTestId('panel');
      let transitionRuns = 0;

      panel.addEventListener('transitionrun', () => {
        transitionRuns += 1;
      });

      await user.click(trigger);

      await waitFor(() => {
        expect(panel).toHaveAttribute('data-open');
        expect(panel.style.getPropertyValue('--collapsible-panel-height')).toBe('auto');
      });

      transitionRuns = 0;

      await user.click(toggle);
      await user.click(toggle);

      await waitFor(() => {
        expect(panel).toHaveAttribute('data-open');
      });

      expect(transitionRuns).toBe(0);
    });

    it('does not replay open keyframe animations when revealing an initially open panel', async () => {
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
                  height: var(--collapsible-panel-height);
                }
              }

              .animation-test-panel[data-open] {
                overflow: hidden;
                animation: panel-slide-down 100ms linear;
              }
            `}</style>

            <button type="button" onClick={() => setVisible((prev) => !prev)}>
              toggle activity
            </button>

            <Activity mode={visible ? 'visible' : 'hidden'}>
              <Collapsible.Root defaultOpen>
                <Collapsible.Trigger>Trigger</Collapsible.Trigger>
                <Collapsible.Panel className="animation-test-panel" data-testid="panel" keepMounted>
                  {PANEL_CONTENT}
                </Collapsible.Panel>
              </Collapsible.Root>
            </Activity>
          </React.Fragment>
        );
      }

      const { user } = await render(<App />);

      const toggle = screen.getByRole('button', { name: 'toggle activity' });
      const panel = screen.getByTestId('panel');

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

    it('does not replay open keyframe animations when revealing a panel opened by the user', async () => {
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
                  height: var(--collapsible-panel-height);
                }
              }

              .animation-test-panel[data-open] {
                overflow: hidden;
                animation: panel-slide-down 100ms linear;
              }
            `}</style>

            <button type="button" onClick={() => setVisible((prev) => !prev)}>
              toggle activity
            </button>

            <Activity mode={visible ? 'visible' : 'hidden'}>
              <Collapsible.Root>
                <Collapsible.Trigger>Trigger</Collapsible.Trigger>
                <Collapsible.Panel className="animation-test-panel" data-testid="panel" keepMounted>
                  {PANEL_CONTENT}
                </Collapsible.Panel>
              </Collapsible.Root>
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
                  height: var(--collapsible-panel-height);
                }
              }
            `}</style>

            <button type="button" onClick={() => setVisible((prev) => !prev)}>
              toggle activity
            </button>

            <Activity mode={visible ? 'visible' : 'hidden'}>
              <Collapsible.Root>
                <Collapsible.Trigger>Trigger</Collapsible.Trigger>
                <Collapsible.Panel
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
                </Collapsible.Panel>
              </Collapsible.Root>
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

  describe.skipIf(isJSDOM || reactMajor < 19 || !('onbeforematch' in window))(
    'interrupted beforematch opens',
    () => {
      it('keeps the temporary zero animation duration until the panel closes', async () => {
        function App() {
          return (
            <React.Fragment>
              <style>{`
                @keyframes panel-slide-down {
                  from {
                    height: 0;
                  }

                  to {
                    height: var(--collapsible-panel-height);
                  }
                }

                @keyframes panel-slide-up {
                  from {
                    height: var(--collapsible-panel-height);
                  }

                  to {
                    height: 0;
                  }
                }

                .animation-test-panel {
                  overflow: hidden;
                  animation-duration: 123ms;
                }

                .animation-test-panel[data-open] {
                  animation-name: panel-slide-down;
                }

                .animation-test-panel[data-closed] {
                  animation-name: panel-slide-up;
                }
              `}</style>

              <Collapsible.Root>
                <Collapsible.Trigger>Trigger</Collapsible.Trigger>
                <Collapsible.Panel
                  className="animation-test-panel"
                  data-testid="panel"
                  hiddenUntilFound
                  keepMounted
                >
                  {PANEL_CONTENT}
                </Collapsible.Panel>
              </Collapsible.Root>
            </React.Fragment>
          );
        }

        const { user } = await render(<App />);

        const panel = screen.getByTestId('panel');
        const trigger = screen.getByRole('button', { name: 'Trigger' });

        fireBeforeMatch(panel);

        await waitFor(() => {
          expect(panel).toHaveAttribute('data-open');
        });

        await act(async () => {
          await waitForAnimationFrame();
          await waitForAnimationFrame();
        });

        expect(getComputedStyle(panel).animationDuration).toBe('0s');

        await user.click(trigger);

        await waitFor(() => {
          expect(panel).toHaveAttribute('data-closed');
          expect(panel.getAnimations().length).toBe(1);
        });

        expect(getComputedStyle(panel).animationDuration).toBe('0.123s');
      });

      it('restores the transition duration before the first close after a beforematch open', async () => {
        function App() {
          return (
            <React.Fragment>
              <style>{`
                .transition-test-panel {
                  overflow: hidden;
                  height: var(--collapsible-panel-height);
                  transition-property: height;
                  transition-duration: 999ms;
                  transition-timing-function: linear;
                }

                .transition-test-panel[data-starting-style],
                .transition-test-panel[data-ending-style] {
                  height: 0;
                }
              `}</style>

              <Collapsible.Root>
                <Collapsible.Trigger>Trigger</Collapsible.Trigger>
                <Collapsible.Panel
                  className="transition-test-panel"
                  data-testid="panel"
                  hiddenUntilFound
                  keepMounted
                  style={{ transitionDuration: '123ms' }}
                >
                  {PANEL_CONTENT}
                </Collapsible.Panel>
              </Collapsible.Root>
            </React.Fragment>
          );
        }

        const { user } = await render(<App />);

        const panel = screen.getByTestId('panel');
        const trigger = screen.getByRole('button', { name: 'Trigger' });

        fireBeforeMatch(panel);

        await waitFor(() => {
          expect(panel).toHaveAttribute('data-open');
        });

        await act(async () => {
          await waitForAnimationFrame();
          await waitForAnimationFrame();
        });

        expect(getComputedStyle(panel).transitionDuration).toBe('0s');

        await user.click(trigger);

        await waitFor(() => {
          expect(panel).toHaveAttribute('data-ending-style');
          expect(panel.style.transitionDuration).toBe('123ms');
          expect(panel.getAnimations().length).toBe(1);
        });
      });

      it('does not suppress a later animated open after a no-motion beforematch open', async () => {
        function App() {
          const [motionEnabled, setMotionEnabled] = React.useState(false);

          return (
            <React.Fragment>
              <style>{`
                .transition-test-panel {
                  overflow: hidden;
                  height: var(--collapsible-panel-height);
                  transition: height 100ms linear;
                }

                .transition-test-panel[data-starting-style],
                .transition-test-panel[data-ending-style] {
                  height: 0;
                }
              `}</style>

              <button type="button" onClick={() => setMotionEnabled(true)}>
                enable motion
              </button>

              <Collapsible.Root>
                <Collapsible.Trigger>Trigger</Collapsible.Trigger>
                <Collapsible.Panel
                  className={motionEnabled ? 'transition-test-panel' : undefined}
                  data-testid="panel"
                  hiddenUntilFound
                  keepMounted
                  style={motionEnabled ? { transitionDuration: '123ms' } : undefined}
                >
                  {PANEL_CONTENT}
                </Collapsible.Panel>
              </Collapsible.Root>
            </React.Fragment>
          );
        }

        const { user } = await render(<App />);

        const panel = screen.getByTestId('panel');
        const trigger = screen.getByRole('button', { name: 'Trigger' });
        const enableMotion = screen.getByRole('button', { name: 'enable motion' });

        fireBeforeMatch(panel);

        await waitFor(() => {
          expect(panel).toHaveAttribute('data-open');
        });

        await user.click(trigger);

        await waitFor(() => {
          expect(panel).toHaveAttribute('data-closed');
        });

        await user.click(enableMotion);
        fireEvent.click(trigger);

        expect(panel).toHaveAttribute('data-open');
        expect(panel.style.transitionDuration).toBe('123ms');
      });

      it('restores the inline transition duration when an instant open is interrupted', async () => {
        const Activity = getActivity();

        function App() {
          const [visible, setVisible] = React.useState(true);

          return (
            <React.Fragment>
              <style>{`
                .transition-test-panel {
                  overflow: hidden;
                  height: var(--collapsible-panel-height);
                  transition-property: height;
                  transition-duration: 999ms;
                  transition-timing-function: linear;
                }

                .transition-test-panel[data-starting-style],
                .transition-test-panel[data-ending-style] {
                  height: 0;
                }
              `}</style>

              <button type="button" onClick={() => setVisible((prev) => !prev)}>
                toggle activity
              </button>

              <Activity mode={visible ? 'visible' : 'hidden'}>
                <Collapsible.Root>
                  <Collapsible.Trigger>Trigger</Collapsible.Trigger>
                  <Collapsible.Panel
                    className="transition-test-panel"
                    data-testid="panel"
                    hiddenUntilFound
                    keepMounted
                    style={{ transitionDuration: '123ms' }}
                  >
                    {PANEL_CONTENT}
                  </Collapsible.Panel>
                </Collapsible.Root>
              </Activity>
            </React.Fragment>
          );
        }

        await render(<App />);

        const panel = screen.getByTestId('panel');
        const toggle = screen.getByRole('button', { name: 'toggle activity' });

        fireBeforeMatch(panel);
        fireEvent.click(toggle);

        fireEvent.click(toggle);

        await waitFor(() => {
          expect(panel).toHaveAttribute('data-open');
          expect(panel.style.transitionDuration).toBe('123ms');
        });
      });

      it('does not keep a hidden transition running after a hiddenUntilFound panel closes', async () => {
        function App() {
          return (
            <React.Fragment>
              <style>{`
                .transition-test-panel {
                  overflow: hidden;
                  height: var(--collapsible-panel-height);
                  opacity: 1;
                  transition:
                    height 1000ms linear,
                    opacity 1000ms linear;
                }

                .transition-test-panel[data-starting-style],
                .transition-test-panel[data-ending-style] {
                  height: 0;
                  opacity: 0;
                }
              `}</style>

              <Collapsible.Root>
                <Collapsible.Trigger>Trigger</Collapsible.Trigger>
                <Collapsible.Panel
                  className="transition-test-panel"
                  data-testid="panel"
                  hiddenUntilFound
                >
                  {PANEL_CONTENT}
                </Collapsible.Panel>
              </Collapsible.Root>
            </React.Fragment>
          );
        }

        const { user } = await render(<App />);

        const panel = screen.getByTestId('panel');
        const trigger = screen.getByRole('button', { name: 'Trigger' });

        await user.click(trigger);

        await waitFor(() => {
          expect(panel).toHaveAttribute('data-open');
        });

        await user.click(trigger);

        await waitFor(() => {
          expect(panel).toHaveAttribute('hidden', 'until-found');
        });

        await act(async () => {
          await waitForAnimationFrame();
          await waitForAnimationFrame();
        });

        expect(
          panel.getAnimations().filter((animation) => animation.playState !== 'finished').length,
        ).toBe(0);
        expect(getComputedStyle(panel).opacity).toBe('0');
      });
    },
  );

  // we test firefox in browserstack which does not support this yet
  describe.skipIf(!('onbeforematch' in window) || isJSDOM)('prop: hiddenUntilFound', () => {
    it('does not open or suppress the next trigger open when beforematch is canceled', async () => {
      const handleOpenChange = vi.fn(
        (nextOpen, eventDetails: Collapsible.Root.ChangeEventDetails) => {
          if (eventDetails.reason === REASONS.none) {
            eventDetails.cancel();
          }
        },
      );

      const { user } = await render(
        <React.Fragment>
          <style>{`
            .transition-test-panel {
              overflow: hidden;
              height: var(--collapsible-panel-height);
              transition-property: height;
              transition-duration: 999ms;
              transition-timing-function: linear;
            }

            .transition-test-panel[data-starting-style],
            .transition-test-panel[data-ending-style] {
              height: 0;
            }
          `}</style>

          <Collapsible.Root onOpenChange={handleOpenChange}>
            <Collapsible.Trigger>Trigger</Collapsible.Trigger>
            <Collapsible.Panel
              className="transition-test-panel"
              data-testid="panel"
              hiddenUntilFound
              keepMounted
              // Verifies canceled beforematch does not install the temporary 0s override.
              style={{ transitionDuration: '123ms' }}
            >
              {PANEL_CONTENT}
            </Collapsible.Panel>
          </Collapsible.Root>
        </React.Fragment>,
      );

      const panel = screen.getByTestId('panel');
      const trigger = screen.getByRole('button', { name: 'Trigger' });

      fireBeforeMatch(panel);

      expect(handleOpenChange).toHaveBeenCalledOnce();
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(panel).toHaveAttribute('data-closed');

      await user.click(trigger);

      expect(handleOpenChange).toHaveBeenCalledTimes(2);
      expect(panel).toHaveAttribute('data-open');
      expect(panel.style.transitionDuration).toBe('123ms');
    });

    it('uses `hidden="until-found" to hide panel when true', async () => {
      const handleOpenChange = vi.fn();

      await render(
        <Collapsible.Root defaultOpen={false} onOpenChange={handleOpenChange}>
          <Collapsible.Trigger />
          <Collapsible.Panel hiddenUntilFound keepMounted>
            {PANEL_CONTENT}
          </Collapsible.Panel>
        </Collapsible.Root>,
      );

      const panel = screen.getByText(PANEL_CONTENT);

      fireBeforeMatch(panel);

      expect(handleOpenChange.mock.calls.length).toBe(1);
      expect(panel).toHaveAttribute('data-open');
    });
  });
});
