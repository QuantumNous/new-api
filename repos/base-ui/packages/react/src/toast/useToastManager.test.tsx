import { expect, vi } from 'vitest';
import * as React from 'react';
import { Toast } from '@base-ui/react/toast';
import { Dialog } from '@base-ui/react/dialog';
import { fireEvent, flushMicrotasks, screen } from '@mui/internal-test-utils';
import { createRenderer, isJSDOM } from '#test-utils';
import { useToastManager } from './useToastManager';
import { List } from './utils/test-utils';

async function tick(clock: ReturnType<typeof createRenderer>['clock'], ms: number) {
  clock.tick(ms);
  await flushMicrotasks();
}

describe.skipIf(!isJSDOM)('useToast', () => {
  describe('add', () => {
    const { clock, render } = createRenderer();

    clock.withFakeTimers();

    it('adds a toast to the viewport that auto-dismisses after 5s by default', async () => {
      function AddButton() {
        const { add } = useToastManager();
        return (
          <button
            onClick={() => {
              add({
                title: 'test',
              });
            }}
          >
            add
          </button>
        );
      }

      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <List />
          </Toast.Viewport>
          <AddButton />
        </Toast.Provider>,
      );

      const button = screen.getByRole('button', { name: 'add' });
      fireEvent.click(button);

      expect(screen.queryByTestId('root')).not.toBe(null);

      await tick(clock, 5000);

      expect(screen.queryByTestId('root')).toBe(null);
    });

    it('keeps multiple providers isolated when one provider updates', async () => {
      function ProviderContents(props: { label: string; title: string }) {
        const { add, update, toasts } = useToastManager();
        const idRef = React.useRef<string | null>(null);

        return (
          <React.Fragment>
            <Toast.Viewport>
              {toasts.map((toast) => (
                <Toast.Root key={toast.id} toast={toast}>
                  <Toast.Title>{toast.title}</Toast.Title>
                </Toast.Root>
              ))}
            </Toast.Viewport>
            <button
              onClick={() => {
                idRef.current = add({
                  title: props.title,
                });
              }}
            >
              add {props.label}
            </button>
            <button
              onClick={() => {
                if (idRef.current) {
                  update(idRef.current, {
                    title: `${props.title} updated`,
                  });
                }
              }}
            >
              update {props.label}
            </button>
          </React.Fragment>
        );
      }

      await render(
        <React.Fragment>
          <Toast.Provider>
            <ProviderContents label="first" title="First toast" />
          </Toast.Provider>
          <Toast.Provider>
            <ProviderContents label="second" title="Second toast" />
          </Toast.Provider>
        </React.Fragment>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'add first' }));
      fireEvent.click(screen.getByRole('button', { name: 'add second' }));

      expect(screen.getByText('First toast')).not.toBe(null);
      expect(screen.getByText('Second toast')).not.toBe(null);

      fireEvent.click(screen.getByRole('button', { name: 'update first' }));

      expect(screen.getByText('First toast updated')).not.toBe(null);
      expect(screen.queryByText('Second toast updated')).toBe(null);
      expect(screen.getByText('Second toast')).not.toBe(null);
    });

    it('replaces a closing toast when adding again with the same id', async () => {
      function Buttons() {
        const { add, close, toasts } = useToastManager();
        const toastIdRef = React.useRef<string | null>(null);

        return (
          <React.Fragment>
            <button
              onClick={() => {
                toastIdRef.current = add({
                  id: 'save',
                  title: 'Saving…',
                  timeout: 0,
                });
              }}
            >
              add
            </button>
            <button
              onClick={() => {
                if (toastIdRef.current) {
                  close(toastIdRef.current);
                }
              }}
            >
              close
            </button>
            <button
              onClick={() => {
                toastIdRef.current = add({
                  id: 'save',
                  title: 'Saved',
                  timeout: 0,
                });
              }}
            >
              re-add
            </button>
            <div data-testid="toast-count">{toasts.length}</div>
          </React.Fragment>
        );
      }

      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <List />
          </Toast.Viewport>
          <Buttons />
        </Toast.Provider>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'add' }));
      expect(screen.getByTestId('title')).toHaveTextContent('Saving…');
      expect(screen.queryAllByTestId('root')).toHaveLength(1);

      fireEvent.click(screen.getByRole('button', { name: 'close' }));
      fireEvent.click(screen.getByRole('button', { name: 're-add' }));

      expect(screen.getByTestId('title')).toHaveTextContent('Saved');
      expect(screen.queryAllByTestId('root')).toHaveLength(1);
      expect(screen.getByTestId('toast-count')).toHaveTextContent('1');
    });

    it('does not call onRemove when replacing an ending toast', async () => {
      const onRemoveSpy = vi.fn();

      function Buttons() {
        const { add, close, toasts } = useToastManager();
        const toastIdRef = React.useRef<string | null>(null);

        return (
          <React.Fragment>
            <button
              onClick={() => {
                toastIdRef.current = add({
                  id: 'save',
                  title: 'Saving…',
                  timeout: 0,
                  onRemove: onRemoveSpy,
                });
              }}
            >
              add
            </button>
            <button
              onClick={() => {
                if (toastIdRef.current) {
                  close(toastIdRef.current);
                }
              }}
            >
              close
            </button>
            <button
              onClick={() => {
                toastIdRef.current = add({
                  id: 'save',
                  title: 'Saved',
                  timeout: 0,
                });
              }}
            >
              re-add
            </button>
            <div data-testid="toast-count">{toasts.length}</div>
          </React.Fragment>
        );
      }

      await render(
        <Toast.Provider>
          <Buttons />
        </Toast.Provider>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'add' }));
      expect(screen.getByTestId('toast-count')).toHaveTextContent('1');

      fireEvent.click(screen.getByRole('button', { name: 'close' }));
      fireEvent.click(screen.getByRole('button', { name: 're-add' }));

      expect(screen.getByTestId('toast-count')).toHaveTextContent('1');
      expect(onRemoveSpy).toHaveBeenCalledTimes(0);
    });

    it('calls onRemove once after replacing an ending toast and later removing the replacement', async () => {
      const onRemoveSpy = vi.fn();

      function Buttons() {
        const { add, close, toasts } = useToastManager();
        const toastIdRef = React.useRef<string | null>(null);
        const [showViewport, setShowViewport] = React.useState(false);

        return (
          <React.Fragment>
            {showViewport ? (
              <Toast.Viewport>
                <List />
              </Toast.Viewport>
            ) : null}
            <button
              onClick={() => {
                toastIdRef.current = add({
                  id: 'save',
                  title: 'Saving…',
                  timeout: 0,
                  onRemove: onRemoveSpy,
                });
              }}
            >
              add
            </button>
            <button
              onClick={() => {
                if (toastIdRef.current) {
                  close(toastIdRef.current);
                }
              }}
            >
              close
            </button>
            <button
              onClick={() => {
                toastIdRef.current = add({
                  id: 'save',
                  title: 'Saved',
                  timeout: 0,
                  onRemove: onRemoveSpy,
                });
              }}
            >
              re-add
            </button>
            <button onClick={() => setShowViewport(true)}>show viewport</button>
            <div data-testid="toast-count">{toasts.length}</div>
          </React.Fragment>
        );
      }

      await render(
        <Toast.Provider>
          <Buttons />
        </Toast.Provider>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'add' }));
      fireEvent.click(screen.getByRole('button', { name: 'close' }));
      fireEvent.click(screen.getByRole('button', { name: 're-add' }));

      expect(screen.getByTestId('toast-count')).toHaveTextContent('1');
      expect(onRemoveSpy).toHaveBeenCalledTimes(0);

      fireEvent.click(screen.getByRole('button', { name: 'show viewport' }));
      fireEvent.click(screen.getByRole('button', { name: 'close' }));

      expect(onRemoveSpy).toHaveBeenCalledTimes(1);
    });

    it('ignores transitionStatus when upserting an existing toast', async () => {
      function Buttons() {
        const { add, toasts } = useToastManager();

        return (
          <React.Fragment>
            <button
              onClick={() => {
                add({
                  id: 'save',
                  title: 'Saving…',
                  timeout: 0,
                });
              }}
            >
              add
            </button>
            <button
              onClick={() => {
                add({
                  id: 'save',
                  title: 'Saved',
                  timeout: 0,
                  transitionStatus: 'ending',
                });
              }}
            >
              upsert
            </button>
            {toasts.map((toast) => (
              <React.Fragment key={toast.id}>
                <div data-testid="title-value">{toast.title}</div>
                <div data-testid="transition-status">{toast.transitionStatus}</div>
              </React.Fragment>
            ))}
          </React.Fragment>
        );
      }

      await render(
        <Toast.Provider>
          <Buttons />
        </Toast.Provider>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'add' }));
      expect(screen.getByTestId('title-value')).toHaveTextContent('Saving…');
      expect(screen.getByTestId('transition-status')).toHaveTextContent('starting');

      fireEvent.click(screen.getByRole('button', { name: 'upsert' }));
      expect(screen.getByTestId('title-value')).toHaveTextContent('Saved');
      expect(screen.getByTestId('transition-status')).toHaveTextContent('starting');
    });

    it('increments updateKey when adding again with the same id', async () => {
      function Buttons() {
        const { add, toasts } = useToastManager();

        return (
          <React.Fragment>
            <button
              onClick={() => {
                add({
                  id: 'save',
                  title: 'Draft saved',
                  timeout: 0,
                });
              }}
            >
              add
            </button>
            {toasts.map((toast) => (
              <div key={toast.id} data-testid="update-key">
                {toast.updateKey}
              </div>
            ))}
          </React.Fragment>
        );
      }

      await render(
        <Toast.Provider>
          <Buttons />
        </Toast.Provider>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'add' }));
      expect(screen.getByTestId('update-key')).toHaveTextContent('0');

      fireEvent.click(screen.getByRole('button', { name: 'add' }));
      expect(screen.getByTestId('update-key')).toHaveTextContent('1');
    });

    describe('option: timeout', () => {
      it('dismisses the toast after the specified timeout', async () => {
        function AddButton() {
          const { add } = useToastManager();
          return <button onClick={() => add({ title: 'test', timeout: 1000 })}>add</button>;
        }

        await render(
          <Toast.Provider>
            <Toast.Viewport>
              <List />
            </Toast.Viewport>
            <AddButton />
          </Toast.Provider>,
        );

        const button = screen.getByRole('button', { name: 'add' });
        fireEvent.click(button);

        expect(screen.queryByTestId('root')).not.toBe(null);

        await tick(clock, 1000);

        expect(screen.queryByTestId('root')).toBe(null);
      });
    });

    describe('option: title', () => {
      it('renders the title', async () => {
        function AddButton() {
          const { add } = useToastManager();
          return (
            <button
              onClick={() =>
                add({
                  title: 'title',
                  description: 'description',
                })
              }
            >
              add
            </button>
          );
        }

        function CustomList() {
          const { toasts } = useToastManager();
          return toasts.map((t) => (
            <Toast.Root key={t.id} toast={t} data-testid="root">
              <Toast.Title data-testid="title">{t.title}</Toast.Title>
            </Toast.Root>
          ));
        }

        await render(
          <Toast.Provider>
            <Toast.Viewport>
              <CustomList />
            </Toast.Viewport>
            <AddButton />
          </Toast.Provider>,
        );

        const button = screen.getByRole('button', { name: 'add' });
        fireEvent.click(button);

        expect(screen.queryByTestId('title')).toHaveTextContent('title');
      });
    });

    describe('option: description', () => {
      it('renders the description', async () => {
        function AddButton() {
          const { add } = useToastManager();
          return (
            <button
              onClick={() =>
                add({
                  title: 'title',
                  description: 'description',
                })
              }
            >
              add
            </button>
          );
        }

        function CustomList() {
          const { toasts } = useToastManager();
          return toasts.map((t) => (
            <Toast.Root key={t.id} toast={t} data-testid="root">
              <Toast.Description data-testid="description">{t.description}</Toast.Description>
            </Toast.Root>
          ));
        }

        await render(
          <Toast.Provider>
            <Toast.Viewport>
              <CustomList />
            </Toast.Viewport>
            <AddButton />
          </Toast.Provider>,
        );

        const button = screen.getByRole('button', { name: 'add' });
        fireEvent.click(button);

        expect(screen.queryByTestId('description')).toHaveTextContent('description');
      });
    });

    describe('option: type', () => {
      it('renders the type', async () => {
        function AddButton() {
          const { add } = useToastManager();
          return <button onClick={() => add({ title: 'test', type: 'success' })}>add</button>;
        }

        function CustomList() {
          const { toasts } = useToastManager();
          return toasts.map((t) => (
            <Toast.Root key={t.id} toast={t} data-testid="root">
              <Toast.Title data-testid="title">{t.title}</Toast.Title>
              <span>{t.type}</span>
            </Toast.Root>
          ));
        }

        await render(
          <Toast.Provider>
            <Toast.Viewport>
              <CustomList />
            </Toast.Viewport>
            <AddButton />
          </Toast.Provider>,
        );

        const button = screen.getByRole('button', { name: 'add' });
        fireEvent.click(button);

        expect(screen.queryByTestId('title')).toHaveTextContent('test');
        expect(screen.queryByText('success')).not.toBe(null);
      });
    });

    describe('option: onClose', () => {
      it('calls onClose when the toast is closed', async () => {
        const onCloseSpy = vi.fn();

        function AddButton() {
          const { add, close } = useToastManager();
          const idRef = React.useRef<string | null>(null);
          return (
            <React.Fragment>
              <button
                onClick={() => {
                  idRef.current = add({
                    title: 'test',
                    onClose: onCloseSpy,
                  });
                }}
              >
                add
              </button>
              <button
                onClick={() => {
                  if (idRef.current) {
                    close(idRef.current);
                  }
                }}
              >
                close
              </button>
            </React.Fragment>
          );
        }

        await render(
          <Toast.Provider>
            <Toast.Viewport>
              <List />
            </Toast.Viewport>
            <AddButton />
          </Toast.Provider>,
        );

        const addButton = screen.getByRole('button', { name: 'add' });
        fireEvent.click(addButton);

        expect(onCloseSpy.mock.calls.length).toBe(0);

        const closeButton = screen.getByRole('button', { name: 'close' });
        fireEvent.click(closeButton);

        expect(onCloseSpy.mock.calls.length).toBe(1);
      });

      it('calls onClose when the toast auto-dismisses', async () => {
        const onCloseSpy = vi.fn();

        function AddButton() {
          const { add } = useToastManager();
          return (
            <button
              onClick={() => {
                add({
                  title: 'test',
                  timeout: 1000,
                  onClose: onCloseSpy,
                });
              }}
            >
              add
            </button>
          );
        }

        await render(
          <Toast.Provider>
            <Toast.Viewport>
              <List />
            </Toast.Viewport>
            <AddButton />
          </Toast.Provider>,
        );

        const button = screen.getByRole('button', { name: 'add' });
        fireEvent.click(button);

        expect(onCloseSpy.mock.calls.length).toBe(0);

        await tick(clock, 1000);

        expect(onCloseSpy.mock.calls.length).toBe(1);
      });
    });

    describe('option: onRemove', () => {
      it('calls onRemove when the toast is removed', async () => {
        const onRemoveSpy = vi.fn();

        function AddButton() {
          const { add, close } = useToastManager();
          const idRef = React.useRef<string | null>(null);
          return (
            <React.Fragment>
              <button
                onClick={() => {
                  idRef.current = add({
                    title: 'test',
                    onRemove: onRemoveSpy,
                  });
                }}
              >
                add
              </button>
              <button
                onClick={() => {
                  if (idRef.current) {
                    close(idRef.current);
                  }
                }}
              >
                close
              </button>
            </React.Fragment>
          );
        }

        await render(
          <Toast.Provider>
            <Toast.Viewport>
              <List />
            </Toast.Viewport>
            <AddButton />
          </Toast.Provider>,
        );

        const addButton = screen.getByRole('button', { name: 'add' });
        fireEvent.click(addButton);

        expect(onRemoveSpy.mock.calls.length).toBe(0);

        const closeButton = screen.getByRole('button', { name: 'close' });
        fireEvent.click(closeButton);

        expect(onRemoveSpy.mock.calls.length).toBe(1);
      });
    });

    describe('option: priority', () => {
      it('applies correct ARIA attributes for high priority toasts', async () => {
        function AddButton() {
          const { add } = useToastManager();
          return (
            <button onClick={() => add({ title: 'high priority', priority: 'high' })}>
              add high
            </button>
          );
        }

        await render(
          <Toast.Provider>
            <Toast.Viewport>
              <List />
            </Toast.Viewport>
            <AddButton />
          </Toast.Provider>,
        );

        const highPriorityButton = screen.getByRole('button', { name: 'add high' });
        fireEvent.click(highPriorityButton);

        const highRoot = screen.getByTestId('root');

        expect(highRoot.getAttribute('role')).toBe('alertdialog');
        expect(highRoot.getAttribute('aria-modal')).toBe('false');
        expect(screen.getByRole('alert')).not.toBe(null);
        expect(screen.getByRole('alert').getAttribute('aria-atomic')).toBe('true');

        const closeHighButton = screen.getByLabelText('close-press');
        fireEvent.click(closeHighButton);

        expect(screen.queryByRole('alert')).toBe(null);
      });
    });
  });

  describe('promise', () => {
    const { clock, render } = createRenderer();

    clock.withFakeTimers();

    function CustomList() {
      const { toasts } = useToastManager();
      return toasts.map((t) => (
        <Toast.Root key={t.id} toast={t} data-testid="root">
          <Toast.Title data-testid="title">{t.title}</Toast.Title>
          <Toast.Description data-testid="description">{t.description}</Toast.Description>
          <Toast.Close aria-label="close-press" />
          <span>{t.type}</span>
        </Toast.Root>
      ));
    }

    it('displays success state as description after promise resolves', async () => {
      function AddButton() {
        const { promise } = useToastManager();
        return (
          <button
            onClick={() => {
              promise(
                new Promise((res) => {
                  setTimeout(() => {
                    res('success');
                  }, 1000);
                }),
                {
                  loading: 'loading',
                  success: 'success',
                  error: 'error',
                },
              );
            }}
          >
            add
          </button>
        );
      }

      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <CustomList />
          </Toast.Viewport>
          <AddButton />
        </Toast.Provider>,
      );

      const button = screen.getByRole('button', { name: 'add' });
      fireEvent.click(button);

      expect(screen.getByTestId('description')).toHaveTextContent('loading');

      await tick(clock, 1000);

      expect(screen.getByTestId('description')).toHaveTextContent('success');
    });

    it('displays error state as description after promise rejects', async () => {
      function AddButton() {
        const { promise } = useToastManager();
        return (
          <button
            onClick={() => {
              promise(
                new Promise((res, rej) => {
                  setTimeout(() => {
                    rej(new Error('error'));
                  }, 1000);
                }),
                {
                  loading: 'loading',
                  success: 'success',
                  error: 'error',
                },
              ).catch(() => {
                // Explicitly catch rejection to prevent test failure
              });
            }}
          >
            add
          </button>
        );
      }

      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <CustomList />
          </Toast.Viewport>
          <AddButton />
        </Toast.Provider>,
      );

      const button = screen.getByRole('button', { name: 'add' });
      fireEvent.click(button);

      expect(screen.getByTestId('description')).toHaveTextContent('loading');

      await tick(clock, 1000);

      expect(screen.getByTestId('description')).toHaveTextContent('error');
    });

    it('passes data when success is a function', async () => {
      function AddButton() {
        const { promise } = useToastManager();
        return (
          <button
            onClick={() =>
              promise(
                new Promise((res) => {
                  res('test success');
                }),
                {
                  loading: 'loading',
                  success: (data) => `${data}`,
                  error: 'error',
                },
              )
            }
          >
            add
          </button>
        );
      }

      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <CustomList />
          </Toast.Viewport>
          <AddButton />
        </Toast.Provider>,
      );

      const button = screen.getByRole('button', { name: 'add' });
      fireEvent.click(button);

      expect(screen.getByTestId('description')).toHaveTextContent('loading');

      await tick(clock, 1000);

      expect(screen.getByTestId('description')).toHaveTextContent('test success');
    });

    it('passes data when error is a function', async () => {
      function AddButton() {
        const { promise } = useToastManager();
        return (
          <button
            onClick={() =>
              promise(
                new Promise((res, rej) => {
                  rej(new Error('test error'));
                }),
                {
                  loading: 'loading',
                  success: 'success',
                  error: (error: Error) => `${error.message}`,
                },
              ).catch(() => {
                // Explicitly catch rejection to prevent test failure
              })
            }
          >
            add
          </button>
        );
      }

      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <CustomList />
          </Toast.Viewport>
          <AddButton />
        </Toast.Provider>,
      );

      const button = screen.getByRole('button', { name: 'add' });
      fireEvent.click(button);

      expect(screen.getByTestId('description')).toHaveTextContent('loading');

      await tick(clock, 1000);

      expect(screen.getByTestId('description')).toHaveTextContent('test error');
    });

    it('supports custom options', async () => {
      function AddButton() {
        const { promise } = useToastManager();
        return (
          <button
            onClick={() =>
              promise(
                new Promise((res) => {
                  res('success');
                }),
                {
                  loading: {
                    title: 'loading title',
                    description: 'loading description',
                  },
                  success: 'success',
                  error: 'error',
                },
              )
            }
          >
            add
          </button>
        );
      }

      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <CustomList />
          </Toast.Viewport>
          <AddButton />
        </Toast.Provider>,
      );

      const button = screen.getByRole('button', { name: 'add' });
      fireEvent.click(button);

      expect(screen.getByTestId('title')).toHaveTextContent('loading title');
      expect(screen.getByTestId('description')).toHaveTextContent('loading description');

      await flushMicrotasks();
    });

    it('does not reopen a dismissed promise toast when it resolves', async () => {
      let resolvePromise: (value: string) => void = () => {
        throw new Error('Promise resolver should be assigned before resolving.');
      };

      function AddButton() {
        const { promise } = useToastManager();
        return (
          <button
            onClick={() => {
              const pendingPromise = new Promise<string>((resolve) => {
                resolvePromise = resolve;
              });

              promise(pendingPromise, {
                loading: 'loading',
                success: 'success',
                error: 'error',
              });
            }}
          >
            add
          </button>
        );
      }

      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <CustomList />
          </Toast.Viewport>
          <AddButton />
        </Toast.Provider>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'add' }));

      expect(screen.getByTestId('description')).toHaveTextContent('loading');

      fireEvent.click(screen.getByLabelText('close-press'));
      resolvePromise('success');

      await flushMicrotasks();

      expect(screen.queryByTestId('root')).toBe(null);
    });

    describe('timeout handling', () => {
      it('auto-dismisses success toast after default timeout when promise resolves', async () => {
        function AddButton() {
          const { promise } = useToastManager();
          return (
            <button
              onClick={() => {
                promise(
                  new Promise((res) => {
                    setTimeout(() => {
                      res('success');
                    }, 1000);
                  }),
                  {
                    loading: 'loading',
                    success: 'success',
                    error: 'error',
                  },
                );
              }}
            >
              add
            </button>
          );
        }

        await render(
          <Toast.Provider>
            <Toast.Viewport>
              <CustomList />
            </Toast.Viewport>
            <AddButton />
          </Toast.Provider>,
        );

        const button = screen.getByRole('button', { name: 'add' });
        fireEvent.click(button);

        expect(screen.getByTestId('description')).toHaveTextContent('loading');

        await tick(clock, 1000);

        expect(screen.getByTestId('description')).toHaveTextContent('success');

        await tick(clock, 5000);

        expect(screen.queryByTestId('root')).toBe(null);
      });

      it('auto-dismisses error toast after default timeout when promise rejects', async () => {
        function AddButton() {
          const { promise } = useToastManager();
          return (
            <button
              onClick={() => {
                promise(
                  new Promise((res, rej) => {
                    setTimeout(() => {
                      rej(new Error('error'));
                    }, 1000);
                  }),
                  {
                    loading: 'loading',
                    success: 'success',
                    error: 'error',
                  },
                ).catch(() => {
                  // Explicitly catch rejection to prevent test failure
                });
              }}
            >
              add
            </button>
          );
        }

        await render(
          <Toast.Provider>
            <Toast.Viewport>
              <CustomList />
            </Toast.Viewport>
            <AddButton />
          </Toast.Provider>,
        );

        const button = screen.getByRole('button', { name: 'add' });
        fireEvent.click(button);

        expect(screen.getByTestId('description')).toHaveTextContent('loading');

        await tick(clock, 1000);

        expect(screen.getByTestId('description')).toHaveTextContent('error');

        await tick(clock, 5000);
        expect(screen.queryByTestId('root')).toBe(null);
      });

      it('uses custom timeout from success options when promise resolves', async () => {
        function AddButton() {
          const { promise } = useToastManager();
          return (
            <button
              onClick={() => {
                promise(
                  new Promise((res) => {
                    setTimeout(() => {
                      res('success');
                    }, 1000);
                  }),
                  {
                    loading: 'loading',
                    success: {
                      description: 'success',
                      timeout: 2000,
                    },
                    error: 'error',
                  },
                );
              }}
            >
              add
            </button>
          );
        }

        await render(
          <Toast.Provider>
            <Toast.Viewport>
              <CustomList />
            </Toast.Viewport>
            <AddButton />
          </Toast.Provider>,
        );

        const button = screen.getByRole('button', { name: 'add' });
        fireEvent.click(button);

        await tick(clock, 1000);

        expect(screen.getByTestId('description')).toHaveTextContent('success');

        await tick(clock, 1000);
        expect(screen.getByTestId('root')).not.toBe(null);

        await tick(clock, 1000);
        expect(screen.queryByTestId('root')).toBe(null);
      });

      it('uses custom timeout from error options when promise rejects', async () => {
        function AddButton() {
          const { promise } = useToastManager();
          return (
            <button
              onClick={() => {
                promise(
                  new Promise((res, rej) => {
                    setTimeout(() => {
                      rej(new Error('error'));
                    }, 1000);
                  }),
                  {
                    loading: 'loading',
                    success: 'success',
                    error: {
                      description: 'error',
                      timeout: 3000,
                    },
                  },
                ).catch(() => {
                  // Explicitly catch rejection to prevent test failure
                });
              }}
            >
              add
            </button>
          );
        }

        await render(
          <Toast.Provider>
            <Toast.Viewport>
              <CustomList />
            </Toast.Viewport>
            <AddButton />
          </Toast.Provider>,
        );

        const button = screen.getByRole('button', { name: 'add' });
        fireEvent.click(button);

        await tick(clock, 1000);

        expect(screen.getByTestId('description')).toHaveTextContent('error');

        await tick(clock, 2000);
        expect(screen.getByTestId('root')).not.toBe(null);

        await tick(clock, 1000);
        expect(screen.queryByTestId('root')).toBe(null);
      });

      it('uses provider timeout when no custom timeout is specified', async () => {
        function AddButton() {
          const { promise } = useToastManager();
          return (
            <button
              onClick={() => {
                promise(
                  new Promise((res) => {
                    setTimeout(() => {
                      res('success');
                    }, 1000);
                  }),
                  {
                    loading: 'loading',
                    success: 'success',
                    error: 'error',
                  },
                );
              }}
            >
              add
            </button>
          );
        }

        await render(
          <Toast.Provider timeout={1000}>
            <Toast.Viewport>
              <CustomList />
            </Toast.Viewport>
            <AddButton />
          </Toast.Provider>,
        );

        const button = screen.getByRole('button', { name: 'add' });
        fireEvent.click(button);

        await tick(clock, 1000);

        expect(screen.getByTestId('description')).toHaveTextContent('success');

        await tick(clock, 1000);
        expect(screen.queryByTestId('root')).toBe(null);
      });

      it('does not inherit a loading timeout when success does not specify one', async () => {
        function AddButton() {
          const { promise } = useToastManager();
          return (
            <button
              onClick={() => {
                promise(
                  new Promise((res) => {
                    setTimeout(() => {
                      res('success');
                    }, 1000);
                  }),
                  {
                    loading: {
                      description: 'loading',
                      timeout: 0,
                    },
                    success: 'success',
                    error: 'error',
                  },
                );
              }}
            >
              add
            </button>
          );
        }

        await render(
          <Toast.Provider>
            <Toast.Viewport>
              <CustomList />
            </Toast.Viewport>
            <AddButton />
          </Toast.Provider>,
        );

        fireEvent.click(screen.getByRole('button', { name: 'add' }));
        expect(screen.getByTestId('description')).toHaveTextContent('loading');

        await tick(clock, 1000);
        expect(screen.getByTestId('description')).toHaveTextContent('success');

        await tick(clock, 5000);
        expect(screen.queryByTestId('root')).toBe(null);
      });

      it('does not auto-dismiss when timeout is set to 0', async () => {
        function AddButton() {
          const { promise } = useToastManager();
          return (
            <button
              onClick={() => {
                promise(
                  new Promise((res) => {
                    setTimeout(() => {
                      res('success');
                    }, 1000);
                  }),
                  {
                    loading: 'loading',
                    success: {
                      description: 'success',
                      timeout: 0,
                    },
                    error: 'error',
                  },
                );
              }}
            >
              add
            </button>
          );
        }

        await render(
          <Toast.Provider>
            <Toast.Viewport>
              <CustomList />
            </Toast.Viewport>
            <AddButton />
          </Toast.Provider>,
        );

        const button = screen.getByRole('button', { name: 'add' });
        fireEvent.click(button);

        await tick(clock, 1000);

        expect(screen.getByTestId('description')).toHaveTextContent('success');

        await tick(clock, 10000);
        expect(screen.getByTestId('root')).not.toBe(null);
      });

      it('pauses timers when hovering over toast', async () => {
        function AddButton() {
          const { promise } = useToastManager();
          return (
            <button
              onClick={() => {
                promise(
                  new Promise((res) => {
                    setTimeout(() => {
                      res('success');
                    }, 1000);
                  }),
                  {
                    loading: 'loading',
                    success: {
                      description: 'success',
                      timeout: 3000,
                    },
                    error: 'error',
                  },
                );
              }}
            >
              add
            </button>
          );
        }

        await render(
          <Toast.Provider>
            <Toast.Viewport>
              <CustomList />
            </Toast.Viewport>
            <AddButton />
          </Toast.Provider>,
        );

        const button = screen.getByRole('button', { name: 'add' });
        fireEvent.click(button);

        await tick(clock, 1000);

        expect(screen.getByTestId('description')).toHaveTextContent('success');

        await tick(clock, 1000);

        const toast = screen.getByTestId('root');
        fireEvent.mouseEnter(toast);

        await tick(clock, 5000);
        expect(screen.getByTestId('root')).not.toBe(null);

        fireEvent.mouseLeave(toast);
        await tick(clock, 2000);
        expect(screen.queryByTestId('root')).toBe(null);
      });
    });
  });

  describe('update', () => {
    const { clock, render } = createRenderer();

    clock.withFakeTimers();

    function CustomList() {
      const { toasts } = useToastManager();
      return toasts.map((t) => (
        <Toast.Root key={t.id} toast={t} data-testid="root">
          <Toast.Title data-testid="title">{t.title}</Toast.Title>
        </Toast.Root>
      ));
    }

    it('updates the toast', async () => {
      function AddButton() {
        const { add, update } = useToastManager();
        const idRef = React.useRef<string | null>(null);
        return (
          <React.Fragment>
            <button
              type="button"
              onClick={() => {
                idRef.current = add({ title: 'test' });
              }}
            >
              add
            </button>
            <button
              type="button"
              onClick={() => {
                if (idRef.current) {
                  update(idRef.current, { title: 'updated' });
                }
              }}
            >
              update
            </button>
          </React.Fragment>
        );
      }

      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <CustomList />
          </Toast.Viewport>
          <AddButton />
        </Toast.Provider>,
      );

      const button = screen.getByRole('button', { name: 'add' });
      fireEvent.click(button);

      expect(screen.getByTestId('title')).toHaveTextContent('test');

      const updateButton = screen.getByRole('button', { name: 'update' });
      fireEvent.click(updateButton);

      expect(screen.getByTestId('title')).toHaveTextContent('updated');
    });

    it('increments updateKey when updating a toast', async () => {
      function Buttons() {
        const { add, update, toasts } = useToastManager();
        const idRef = React.useRef<string | null>(null);

        return (
          <React.Fragment>
            <button
              type="button"
              onClick={() => {
                idRef.current = add({
                  id: 'save',
                  title: 'Draft saved',
                  timeout: 0,
                });
              }}
            >
              add
            </button>
            <button
              type="button"
              onClick={() => {
                if (idRef.current) {
                  update(idRef.current, { title: 'Draft synced' });
                }
              }}
            >
              update
            </button>
            {toasts.map((toast) => (
              <div key={toast.id} data-testid="update-key">
                {toast.updateKey}
              </div>
            ))}
          </React.Fragment>
        );
      }

      await render(
        <Toast.Provider>
          <Buttons />
        </Toast.Provider>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'add' }));
      expect(screen.getByTestId('update-key')).toHaveTextContent('0');

      fireEvent.click(screen.getByRole('button', { name: 'update' }));
      expect(screen.getByTestId('update-key')).toHaveTextContent('1');
    });

    it('auto-dismisses when timeout changes from 0 to a positive value', async () => {
      function AddButton() {
        const { add, update } = useToastManager();
        const idRef = React.useRef<string | null>(null);
        return (
          <React.Fragment>
            <button
              type="button"
              onClick={() => {
                idRef.current = add({ title: 'test', timeout: 0 });
              }}
            >
              add
            </button>
            <button
              type="button"
              onClick={() => {
                if (idRef.current) {
                  update(idRef.current, { timeout: 1000 });
                }
              }}
            >
              update
            </button>
          </React.Fragment>
        );
      }

      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <CustomList />
          </Toast.Viewport>
          <AddButton />
        </Toast.Provider>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'add' }));
      expect(screen.queryByTestId('root')).not.toBe(null);

      fireEvent.click(screen.getByRole('button', { name: 'update' }));
      await tick(clock, 1000);

      expect(screen.queryByTestId('root')).toBe(null);
    });

    it('schedules a timer when updating a loading toast to a non-loading type', async () => {
      function AddButton() {
        const { add, update } = useToastManager();
        const idRef = React.useRef<string | null>(null);
        return (
          <React.Fragment>
            <button
              type="button"
              onClick={() => {
                idRef.current = add({ title: 'loading', type: 'loading' });
              }}
            >
              add
            </button>
            <button
              type="button"
              onClick={() => {
                if (idRef.current) {
                  update(idRef.current, { title: 'success', type: 'success', timeout: 1000 });
                }
              }}
            >
              update
            </button>
          </React.Fragment>
        );
      }

      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <CustomList />
          </Toast.Viewport>
          <AddButton />
        </Toast.Provider>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'add' }));
      expect(screen.getByTestId('title')).toHaveTextContent('loading');

      fireEvent.click(screen.getByRole('button', { name: 'update' }));
      expect(screen.getByTestId('title')).toHaveTextContent('success');

      await tick(clock, 1000);
      expect(screen.queryByTestId('root')).toBe(null);
    });
  });

  describe('close', () => {
    const { clock, render } = createRenderer();

    clock.withFakeTimers();

    function CustomList() {
      const { toasts } = useToastManager();
      return toasts.map((t) => (
        <Toast.Root key={t.id} toast={t} data-testid="root">
          <Toast.Title data-testid="title">{t.title}</Toast.Title>
        </Toast.Root>
      ));
    }

    it('closes a toast', async () => {
      function AddButton() {
        const { add, close } = useToastManager();
        const idRef = React.useRef<string | null>(null);
        return (
          <React.Fragment>
            <button
              onClick={() => {
                idRef.current = add({ title: 'test' });
              }}
            >
              add
            </button>
            <button
              onClick={() => {
                if (idRef.current) {
                  close(idRef.current);
                }
              }}
            >
              close
            </button>
          </React.Fragment>
        );
      }

      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <CustomList />
          </Toast.Viewport>
          <AddButton />
        </Toast.Provider>,
      );

      const addButton = screen.getByRole('button', { name: 'add' });
      fireEvent.click(addButton);

      expect(screen.getByTestId('root')).not.toBe(null);

      const closeButton = screen.getByRole('button', { name: 'close' });
      fireEvent.click(closeButton);

      expect(screen.queryByTestId('root')).toBe(null);
    });

    it('closes all toasts', async () => {
      function AddButton() {
        const { add, close } = useToastManager();
        return (
          <React.Fragment>
            <button
              onClick={() => {
                add({ title: 'test' });
              }}
            >
              add
            </button>
            <button
              onClick={() => {
                close();
              }}
            >
              close
            </button>
          </React.Fragment>
        );
      }

      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <CustomList />
          </Toast.Viewport>
          <AddButton />
        </Toast.Provider>,
      );

      const addButton = screen.getByRole('button', { name: 'add' });
      Array.from({ length: 5 }).forEach(() => {
        fireEvent.click(addButton);
      });

      expect(screen.getAllByTestId('root')).toHaveLength(5);

      const closeButton = screen.getByRole('button', { name: 'close' });
      fireEvent.click(closeButton);

      expect(screen.queryByTestId('root')).toBe(null);
    });
  });

  describe('prop: limit', () => {
    const { clock, render } = createRenderer();

    clock.withFakeTimers();

    function TestList() {
      const [count, setCount] = React.useState(0);
      const { toasts, add } = useToastManager();
      return (
        <React.Fragment>
          {toasts.map((t) => (
            <Toast.Root key={t.id} toast={t} data-testid={t.title}>
              <Toast.Close data-testid={`close-${t.title}`} />
            </Toast.Root>
          ))}
          <button
            onClick={() => {
              const nextCount = count + 1;
              setCount(nextCount);
              add({ title: `toast-${nextCount}` });
            }}
          >
            add
          </button>
        </React.Fragment>
      );
    }

    it('marks toasts as limited when the limit is exceeded', async () => {
      await render(
        <Toast.Provider limit={2}>
          <Toast.Viewport>
            <TestList />
          </Toast.Viewport>
        </Toast.Provider>,
      );

      const addButton = screen.getByRole('button', { name: 'add' });

      fireEvent.click(addButton);
      const toast1 = screen.getByTestId('toast-1');
      expect(toast1).not.toHaveAttribute('data-limited');

      fireEvent.click(addButton);
      const toast2 = screen.getByTestId('toast-2');
      expect(toast2).not.toHaveAttribute('data-limited');

      fireEvent.click(addButton);
      const toast3 = screen.getByTestId('toast-3');
      expect(toast3).not.toHaveAttribute('data-limited');
      expect(toast1).toHaveAttribute('data-limited');
    });

    it('unmarks toasts as limited when the limit is not exceeded', async () => {
      await render(
        <Toast.Provider limit={2}>
          <Toast.Viewport>
            <TestList />
          </Toast.Viewport>
        </Toast.Provider>,
      );

      const addButton = screen.getByRole('button', { name: 'add' });

      fireEvent.click(addButton);
      const toast1 = screen.getByTestId('toast-1');
      expect(toast1).not.toHaveAttribute('data-limited');

      fireEvent.click(addButton);
      const toast2 = screen.getByTestId('toast-2');
      expect(toast2).not.toHaveAttribute('data-limited');

      fireEvent.click(addButton);
      const toast3 = screen.getByTestId('toast-3');
      expect(toast3).not.toHaveAttribute('data-limited');

      const closeToast3 = screen.getByTestId('close-toast-3');
      fireEvent.click(closeToast3);

      expect(toast1).not.toHaveAttribute('data-limited');
    });

    it('preserves limited state when upserting a limited toast', async () => {
      function LimitedToastExample() {
        const { add, toasts } = useToastManager();

        return (
          <React.Fragment>
            {toasts.map((toast) => (
              <Toast.Root key={toast.id} toast={toast} data-testid={String(toast.title)}>
                <Toast.Title />
              </Toast.Root>
            ))}
            <button
              onClick={() => {
                add({ id: 'save', title: 'Saving…', timeout: 0 });
              }}
            >
              add save
            </button>
            <button
              onClick={() => {
                add({ id: 'other', title: 'Other toast', timeout: 0 });
              }}
            >
              add other
            </button>
            <button
              onClick={() => {
                add({ id: 'save', title: 'Saved', timeout: 0 });
              }}
            >
              upsert save
            </button>
          </React.Fragment>
        );
      }

      await render(
        <Toast.Provider limit={1}>
          <Toast.Viewport>
            <LimitedToastExample />
          </Toast.Viewport>
        </Toast.Provider>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'add save' }));
      const savingToast = screen.getByTestId('Saving…');
      expect(savingToast).not.toHaveAttribute('data-limited');

      fireEvent.click(screen.getByRole('button', { name: 'add other' }));
      expect(savingToast).toHaveAttribute('data-limited');
      expect(screen.getByTestId('Other toast')).not.toHaveAttribute('data-limited');

      fireEvent.click(screen.getByRole('button', { name: 'upsert save' }));
      const savedToast = screen.getByTestId('Saved');
      expect(savedToast).toHaveAttribute('data-limited');
      expect(screen.getByTestId('Other toast')).not.toHaveAttribute('data-limited');
    });

    it('recomputes limited toasts when the limit prop changes', async () => {
      function App(props: { limit: number }) {
        return (
          <Toast.Provider limit={props.limit}>
            <Toast.Viewport>
              <TestList />
            </Toast.Viewport>
          </Toast.Provider>
        );
      }

      const { setProps } = await render(<App limit={1} />);

      const addButton = screen.getByRole('button', { name: 'add' });
      fireEvent.click(addButton);
      fireEvent.click(addButton);

      const toast1 = screen.getByTestId('toast-1');
      const toast2 = screen.getByTestId('toast-2');

      expect(toast2).not.toHaveAttribute('data-limited');
      expect(toast1).toHaveAttribute('data-limited');

      // Raising the limit un-limits the older toast.
      await setProps({ limit: 2 });
      expect(toast1).not.toHaveAttribute('data-limited');

      // Lowering it again re-limits it.
      await setProps({ limit: 1 });
      expect(toast1).toHaveAttribute('data-limited');
    });
  });

  describe('in dialog', () => {
    const { clock, render } = createRenderer();

    clock.withFakeTimers();

    function DialogToastExample() {
      const { add } = useToastManager();
      const [isOpen, setIsOpen] = React.useState(false);

      return (
        <React.Fragment>
          <button onClick={() => setIsOpen(true)}>open dialog</button>
          <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
            <Dialog.Portal>
              <Dialog.Backdrop />
              <Dialog.Popup>
                <button
                  onClick={() =>
                    add({
                      title: 'Toast in dialog',
                      description: 'This toast is in a dialog',
                    })
                  }
                >
                  add
                </button>
                <Dialog.Close />
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
        </React.Fragment>
      );
    }

    function ToastInDialogList() {
      const { toasts } = useToastManager();
      return toasts.map((toast) => (
        <Toast.Root key={toast.id} toast={toast} data-testid="toast-root">
          <Toast.Title data-testid="toast-title">{toast.title}</Toast.Title>
          <Toast.Description data-testid="toast-description">{toast.description}</Toast.Description>
          <Toast.Close data-testid="toast-close" aria-label="close" />
        </Toast.Root>
      ));
    }

    it('toasts in dialogs are accessible and not aria-hidden', async () => {
      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <ToastInDialogList />
          </Toast.Viewport>
          <DialogToastExample />
        </Toast.Provider>,
      );

      const openDialogButton = screen.getByRole('button', { name: 'open dialog' });
      fireEvent.click(openDialogButton);

      expect(screen.getByRole('dialog')).not.toBe(null);

      const addToastButton = screen.getByRole('button', { name: 'add' });
      fireEvent.click(addToastButton);

      const toastRoot = screen.getByTestId('toast-root');
      expect(toastRoot).not.toBe(null);
      expect(screen.getByTestId('toast-title')).toHaveTextContent('Toast in dialog');
      expect(screen.getByTestId('toast-description')).toHaveTextContent(
        'This toast is in a dialog',
      );
    });

    it('high priority toasts in dialogs have correct accessibility structure', async () => {
      function HighPriorityToastInDialog() {
        const { add } = useToastManager();
        return (
          <Dialog.Root open>
            <Dialog.Portal>
              <Dialog.Backdrop />
              <Dialog.Popup>
                <button
                  onClick={() => {
                    add({
                      title: 'High priority toast',
                      description: 'This is urgent',
                      priority: 'high',
                    });
                  }}
                >
                  add
                </button>
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
        );
      }

      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <ToastInDialogList />
          </Toast.Viewport>
          <HighPriorityToastInDialog />
        </Toast.Provider>,
      );

      const addToastButton = screen.getByRole('button', { name: 'add' });
      fireEvent.click(addToastButton);

      const toastRoot = screen.getByTestId('toast-root');
      expect(toastRoot).toHaveAttribute('aria-hidden', 'true');
      expect(screen.queryByRole('alert')).not.toBe(null);
    });
  });
});
