import { expect, vi } from 'vitest';
import * as React from 'react';
import { Toast } from '@base-ui/react/toast';
import { fireEvent, flushMicrotasks, screen } from '@mui/internal-test-utils';
import { createRenderer, isJSDOM } from '#test-utils';
import { List } from './utils/test-utils';

describe.skipIf(!isJSDOM)('createToastManager', () => {
  const { render, clock } = createRenderer();

  clock.withFakeTimers();

  describe('add', () => {
    it('adds a toast', async () => {
      const toastManager = Toast.createToastManager();

      function add() {
        toastManager.add({
          title: 'title',
        });
      }

      function AddButton() {
        return (
          <button type="button" onClick={add}>
            add
          </button>
        );
      }

      await render(
        <Toast.Provider toastManager={toastManager}>
          <Toast.Viewport>
            <List />
          </Toast.Viewport>
          <AddButton />
        </Toast.Provider>,
      );

      expect(screen.queryByTestId('title')).toBe(null);

      const button = screen.getByRole('button', { name: 'add' });
      fireEvent.click(button);

      expect(screen.queryByTestId('title')).not.toBe(null);

      await clock.tickAsync(5000);

      expect(screen.queryByTestId('title')).toBe(null);
    });

    it('returns a toast id', async () => {
      const toastManager = Toast.createToastManager();

      const toastId = toastManager.add({
        title: 'title',
      });

      expect(toastId).toBeTypeOf('string');
    });

    it('upserts a toast when adding with an existing id', async () => {
      const toastManager = Toast.createToastManager();
      let firstToastId = '';
      let secondToastId = '';

      function Buttons() {
        return (
          <React.Fragment>
            <button
              type="button"
              onClick={() => {
                firstToastId = toastManager.add({
                  id: 'save',
                  title: 'Saving…',
                  timeout: 1000,
                });
              }}
            >
              add
            </button>
            <button
              type="button"
              onClick={() => {
                secondToastId = toastManager.add({
                  id: 'save',
                  title: 'Saved',
                  timeout: 1000,
                });
              }}
            >
              upsert
            </button>
          </React.Fragment>
        );
      }

      await render(
        <Toast.Provider toastManager={toastManager}>
          <Toast.Viewport>
            <List />
          </Toast.Viewport>
          <Buttons />
        </Toast.Provider>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'add' }));

      expect(screen.getByTestId('title')).toHaveTextContent('Saving…');
      expect(screen.queryAllByTestId('root')).toHaveLength(1);

      await clock.tickAsync(900);

      fireEvent.click(screen.getByRole('button', { name: 'upsert' }));

      expect(firstToastId).toBe('save');
      expect(secondToastId).toBe(firstToastId);
      expect(screen.getByTestId('title')).toHaveTextContent('Saved');
      expect(screen.queryAllByTestId('root')).toHaveLength(1);

      await clock.tickAsync(200);
      expect(screen.queryByTestId('title')).not.toBe(null);

      await clock.tickAsync(800);
      expect(screen.queryByTestId('title')).toBe(null);
    });
  });

  describe('promise', () => {
    it('adds a toast with the loading state that is updated with the success state', async () => {
      const toastManager = Toast.createToastManager();

      function add() {
        toastManager.promise(
          new Promise((resolve) => {
            setTimeout(() => {
              resolve('success');
            }, 1000);
          }),
          {
            loading: 'loading',
            success: 'success',
            error: 'error',
          },
        );
      }

      function AddButton() {
        return (
          <button type="button" onClick={add}>
            add
          </button>
        );
      }

      await render(
        <Toast.Provider toastManager={toastManager}>
          <Toast.Viewport>
            <List />
          </Toast.Viewport>
          <AddButton />
        </Toast.Provider>,
      );

      const button = screen.getByRole('button', { name: 'add' });
      fireEvent.click(button);
      await flushMicrotasks();

      expect(screen.queryByTestId('description')).toHaveTextContent('loading');

      await clock.tickAsync(1000);

      expect(screen.queryByTestId('description')).toHaveTextContent('success');
    });

    it('does not inherit a loading timeout when success does not specify one', async () => {
      const toastManager = Toast.createToastManager();

      function add() {
        toastManager.promise(
          new Promise((resolve) => {
            setTimeout(() => {
              resolve('success');
            }, 1000);
          }),
          {
            loading: {
              description: 'loading',
              timeout: 0,
            },
            success: {
              description: 'success',
            },
            error: 'error',
          },
        );
      }

      function AddButton() {
        return (
          <button type="button" onClick={add}>
            add
          </button>
        );
      }

      await render(
        <Toast.Provider toastManager={toastManager}>
          <Toast.Viewport>
            <List />
          </Toast.Viewport>
          <AddButton />
        </Toast.Provider>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'add' }));
      await flushMicrotasks();

      expect(screen.queryByTestId('description')).toHaveTextContent('loading');

      await clock.tickAsync(1000);

      expect(screen.queryByTestId('description')).toHaveTextContent('success');

      await clock.tickAsync(5000);

      expect(screen.queryByTestId('description')).toBe(null);
    });

    it('adds a toast with the loading state that is updated with the error state', async () => {
      const toastManager = Toast.createToastManager();

      function promise() {
        toastManager
          .promise(
            new Promise((res, rej) => {
              rej(new Error('error'));
            }),
            {
              loading: 'loading',
              success: 'success',
              error: 'error',
            },
          )
          .catch(() => {
            // Swallow the error
          });
      }

      function AddButton() {
        return (
          <button type="button" onClick={promise}>
            add
          </button>
        );
      }

      await render(
        <Toast.Provider toastManager={toastManager}>
          <Toast.Viewport>
            <List />
          </Toast.Viewport>
          <AddButton />
        </Toast.Provider>,
      );

      const button = screen.getByRole('button', { name: 'add' });
      fireEvent.click(button);
      await flushMicrotasks();

      expect(screen.getByTestId('description')).toHaveTextContent('error');
    });

    it('does not reopen a dismissed promise toast when it resolves', async () => {
      const toastManager = Toast.createToastManager();
      let resolvePromise: (value: string) => void = () => {
        throw new Error('Promise resolver should be assigned before resolving.');
      };

      function add() {
        const pendingPromise = new Promise<string>((resolve) => {
          resolvePromise = resolve;
        });

        toastManager.promise(pendingPromise, {
          loading: 'loading',
          success: 'success',
          error: 'error',
        });
      }

      function Button() {
        return (
          <button type="button" onClick={add}>
            add
          </button>
        );
      }

      await render(
        <Toast.Provider toastManager={toastManager}>
          <Toast.Viewport>
            <List />
          </Toast.Viewport>
          <Button />
        </Toast.Provider>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'add' }));

      expect(screen.getByTestId('description')).toHaveTextContent('loading');

      fireEvent.click(screen.getByLabelText('close-press'));
      resolvePromise('success');

      await flushMicrotasks();

      expect(screen.queryByTestId('title')).toBe(null);
    });
  });

  describe('update', () => {
    it('updates a toast', async () => {
      const toastManager = Toast.createToastManager();

      let toastId: string;

      function add() {
        toastId = toastManager.add({
          title: 'title',
        });
      }

      function update() {
        toastManager.update(toastId, {
          title: 'updated',
        });
      }

      function Buttons() {
        return (
          <React.Fragment>
            <button type="button" onClick={add}>
              add
            </button>
            <button type="button" onClick={update}>
              update method
            </button>
          </React.Fragment>
        );
      }

      await render(
        <Toast.Provider toastManager={toastManager}>
          <Toast.Viewport>
            <List />
          </Toast.Viewport>
          <Buttons />
        </Toast.Provider>,
      );

      const button = screen.getByRole('button', { name: 'add' });
      fireEvent.click(button);

      const updateButton = screen.getByRole('button', { name: 'update method' });
      fireEvent.click(updateButton);

      expect(screen.getByTestId('title')).toHaveTextContent('updated');
    });

    it('resets the auto-dismiss timer when updating with the same timeout value', async () => {
      const toastManager = Toast.createToastManager();

      let toastId: string;

      function add() {
        toastId = toastManager.add({
          title: 'title',
          timeout: 1000,
        });
      }

      function resetTimeout() {
        toastManager.update(toastId, {
          timeout: 1000,
        });
      }

      function Buttons() {
        return (
          <React.Fragment>
            <button type="button" onClick={add}>
              add
            </button>
            <button type="button" onClick={resetTimeout}>
              reset timeout
            </button>
          </React.Fragment>
        );
      }

      await render(
        <Toast.Provider toastManager={toastManager}>
          <Toast.Viewport>
            <List />
          </Toast.Viewport>
          <Buttons />
        </Toast.Provider>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'add' }));
      expect(screen.queryByTestId('title')).not.toBe(null);

      await clock.tickAsync(900);
      expect(screen.queryByTestId('title')).not.toBe(null);

      fireEvent.click(screen.getByRole('button', { name: 'reset timeout' }));

      await clock.tickAsync(200);
      expect(screen.queryByTestId('title')).not.toBe(null);

      await clock.tickAsync(800);
      expect(screen.queryByTestId('title')).toBe(null);
    });

    it('resets the auto-dismiss timer when updating from 0 to a timeout, then updating with the same timeout again', async () => {
      const toastManager = Toast.createToastManager();

      let toastId: string;

      function add() {
        toastId = toastManager.add({
          title: 'title',
          timeout: 0,
        });
      }

      function setTimeoutTo1000() {
        toastManager.update(toastId, {
          timeout: 1000,
        });
      }

      function resetTimeoutTo1000() {
        toastManager.update(toastId, {
          timeout: 1000,
        });
      }

      function Buttons() {
        return (
          <React.Fragment>
            <button type="button" onClick={add}>
              add
            </button>
            <button type="button" onClick={setTimeoutTo1000}>
              set timeout
            </button>
            <button type="button" onClick={resetTimeoutTo1000}>
              reset timeout
            </button>
          </React.Fragment>
        );
      }

      await render(
        <Toast.Provider toastManager={toastManager}>
          <Toast.Viewport>
            <List />
          </Toast.Viewport>
          <Buttons />
        </Toast.Provider>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'add' }));
      expect(screen.queryByTestId('title')).not.toBe(null);

      fireEvent.click(screen.getByRole('button', { name: 'set timeout' }));

      await clock.tickAsync(900);
      expect(screen.queryByTestId('title')).not.toBe(null);

      fireEvent.click(screen.getByRole('button', { name: 'reset timeout' }));

      await clock.tickAsync(200);
      expect(screen.queryByTestId('title')).not.toBe(null);

      await clock.tickAsync(800);
      expect(screen.queryByTestId('title')).toBe(null);
    });

    it('auto-dismisses when updating timeout from 0 to a positive value', async () => {
      const toastManager = Toast.createToastManager();

      let toastId: string;

      function add() {
        toastId = toastManager.add({
          title: 'title',
          timeout: 0,
        });
      }

      function update() {
        toastManager.update(toastId, {
          timeout: 1000,
        });
      }

      function Buttons() {
        return (
          <React.Fragment>
            <button type="button" onClick={add}>
              add
            </button>
            <button type="button" onClick={update}>
              update method
            </button>
          </React.Fragment>
        );
      }

      await render(
        <Toast.Provider toastManager={toastManager}>
          <Toast.Viewport>
            <List />
          </Toast.Viewport>
          <Buttons />
        </Toast.Provider>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'add' }));
      expect(screen.queryByTestId('title')).not.toBe(null);

      fireEvent.click(screen.getByRole('button', { name: 'update method' }));
      await clock.tickAsync(1000);

      expect(screen.queryByTestId('title')).toBe(null);
    });

    it('schedules a timer when updating a loading toast to a non-loading type', async () => {
      const toastManager = Toast.createToastManager();

      let toastId: string;

      function add() {
        toastId = toastManager.add({
          title: 'loading',
          type: 'loading',
        });
      }

      function update() {
        toastManager.update(toastId, {
          title: 'success',
          type: 'success',
          timeout: 1000,
        });
      }

      function Buttons() {
        return (
          <React.Fragment>
            <button type="button" onClick={add}>
              add
            </button>
            <button type="button" onClick={update}>
              update method
            </button>
          </React.Fragment>
        );
      }

      await render(
        <Toast.Provider toastManager={toastManager}>
          <Toast.Viewport>
            <List />
          </Toast.Viewport>
          <Buttons />
        </Toast.Provider>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'add' }));
      expect(screen.getByTestId('title')).toHaveTextContent('loading');

      fireEvent.click(screen.getByRole('button', { name: 'update method' }));
      expect(screen.getByTestId('title')).toHaveTextContent('success');

      await clock.tickAsync(1000);

      expect(screen.queryByTestId('title')).toBe(null);
    });

    it('does not clear the auto-dismiss timer when updated twice before a re-render', async () => {
      const toastManager = Toast.createToastManager();

      let toastId: string;

      function add() {
        toastId = toastManager.add({
          title: 'loading',
          type: 'loading',
        });
      }

      function doubleUpdate() {
        toastManager.update(toastId, {
          type: 'success',
          timeout: 1000,
        });

        toastManager.update(toastId, {
          title: 'new',
        });
      }

      function Buttons() {
        return (
          <React.Fragment>
            <button type="button" onClick={add}>
              add
            </button>
            <button type="button" onClick={doubleUpdate}>
              double update
            </button>
          </React.Fragment>
        );
      }

      await render(
        <Toast.Provider toastManager={toastManager}>
          <Toast.Viewport>
            <List />
          </Toast.Viewport>
          <Buttons />
        </Toast.Provider>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'add' }));
      expect(screen.getByTestId('title')).toHaveTextContent('loading');

      fireEvent.click(screen.getByRole('button', { name: 'double update' }));
      expect(screen.getByTestId('title')).toHaveTextContent('new');

      await clock.tickAsync(1000);

      expect(screen.queryByTestId('title')).toBe(null);
    });
  });

  describe('close', () => {
    it('closes a toast', async () => {
      const toastManager = Toast.createToastManager();

      let toastId: string;

      function add() {
        toastId = toastManager.add({
          title: 'title',
        });
      }

      function close() {
        toastManager.close(toastId);
      }

      function Buttons() {
        return (
          <React.Fragment>
            <button type="button" onClick={add}>
              add
            </button>
            <button type="button" onClick={close}>
              close
            </button>
          </React.Fragment>
        );
      }

      await render(
        <Toast.Provider toastManager={toastManager}>
          <Toast.Viewport>
            <List />
          </Toast.Viewport>
          <Buttons />
        </Toast.Provider>,
      );

      const button = screen.getByRole('button', { name: 'add' });
      fireEvent.click(button);

      const closeButton = screen.getByRole('button', { name: 'close' });
      fireEvent.click(closeButton);

      expect(screen.queryByTestId('title')).toBe(null);
    });

    it('closes all toasts', async () => {
      const toastManager = Toast.createToastManager();

      function add() {
        toastManager.add({ title: 'title' });
      }

      function close() {
        toastManager.close();
      }

      function Buttons() {
        return (
          <React.Fragment>
            <button type="button" onClick={add}>
              add
            </button>
            <button type="button" onClick={close}>
              close
            </button>
          </React.Fragment>
        );
      }

      await render(
        <Toast.Provider toastManager={toastManager}>
          <Toast.Viewport>
            <List />
          </Toast.Viewport>
          <Buttons />
        </Toast.Provider>,
      );

      const button = screen.getByRole('button', { name: 'add' });
      Array.from({ length: 5 }).forEach(() => {
        fireEvent.click(button);
      });

      const closeButton = screen.getByRole('button', { name: 'close' });
      fireEvent.click(closeButton);

      expect(screen.queryByTestId('title')).toBe(null);
    });

    it('does not call onClose when closing toasts that are already ending', async () => {
      const toastManager = Toast.createToastManager();
      const onCloseSpy1 = vi.fn(() => {
        toastManager.close();
      });
      const onCloseSpy2 = vi.fn();
      let toastId1: string;

      function add() {
        toastId1 = toastManager.add({
          title: 'toast 1',
          onClose: onCloseSpy1,
        });

        toastManager.add({
          title: 'toast 2',
          onClose: onCloseSpy2,
        });
      }

      function close() {
        toastManager.close(toastId1);
      }

      function Buttons() {
        return (
          <React.Fragment>
            <button type="button" onClick={add}>
              add
            </button>
            <button type="button" onClick={close}>
              close
            </button>
          </React.Fragment>
        );
      }

      await render(
        <Toast.Provider toastManager={toastManager}>
          <Toast.Viewport>
            <List />
          </Toast.Viewport>
          <Buttons />
        </Toast.Provider>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'add' }));
      fireEvent.click(screen.getByRole('button', { name: 'close' }));

      expect(onCloseSpy1.mock.calls.length).toBe(1);
      expect(onCloseSpy2.mock.calls.length).toBe(1);
    });
  });
});
