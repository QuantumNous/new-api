import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';

import { useForm } from '../../useForm';

describe('setFocus', () => {
  it('should focus input when called after setError', async () => {
    const App = () => {
      const { register, setError, setFocus } = useForm({
        mode: 'onChange',
      });

      return (
        <div>
          <input {...register('email')} placeholder="email" />
          <button
            type="button"
            onClick={() => {
              setError('email', {
                type: 'custom',
                message: 'An account with this email already exists.',
              });
              setFocus('email');
            }}
          >
            Trigger Error and Focus
          </button>
        </div>
      );
    };

    render(<App />);

    const button = screen.getByRole('button');
    const emailInput = screen.getByPlaceholderText('email');

    await act(async () => {
      button.click();
    });

    // Wait for the focus to be set after the microtask
    await waitFor(
      () => {
        expect(document.activeElement).toBe(emailInput);
      },
      { timeout: 100 },
    );
  });

  it('should focus the correct field', async () => {
    const Component = () => {
      const { register, setFocus } = useForm();

      return (
        <form>
          <input {...register('test')} placeholder="test" />
          <input {...register('test1')} placeholder="test1" />
          <button
            type="button"
            onClick={() => {
              setFocus('test1');
            }}
          >
            setFocus
          </button>
        </form>
      );
    };

    render(<Component />);

    screen.getByRole('button').click();

    await waitFor(
      () => {
        expect(document.activeElement).toBe(
          screen.getByPlaceholderText('test1'),
        );
      },
      { timeout: 100 },
    );
  });

  it('should select the field value when shouldSelect is true', async () => {
    const Component = () => {
      const { register, setFocus } = useForm();

      return (
        <form>
          <input {...register('test')} defaultValue="test" placeholder="test" />
          <button
            type="button"
            onClick={() => {
              setFocus('test', { shouldSelect: true });
            }}
          >
            setFocus
          </button>
        </form>
      );
    };

    render(<Component />);

    const input = screen.getByPlaceholderText('test') as HTMLInputElement;

    screen.getByRole('button').click();

    await waitFor(
      () => {
        expect(document.activeElement).toBe(input);
        // In jsdom, selectionStart and selectionEnd will be set when select() is called
        expect(input.selectionStart).toBe(0);
        expect(input.selectionEnd).toBe(input.value.length);
      },
      { timeout: 100 },
    );
  });

  it('should work with field arrays', async () => {
    const Component = () => {
      const { register, setFocus } = useForm();

      return (
        <form>
          <input {...register('items.0.name')} placeholder="item-0" />
          <input {...register('items.1.name')} placeholder="item-1" />
          <button
            type="button"
            onClick={() => {
              setFocus('items.1.name');
            }}
          >
            Focus Item 1
          </button>
        </form>
      );
    };

    render(<Component />);

    screen.getByRole('button').click();

    await waitFor(
      () => {
        expect(document.activeElement).toBe(
          screen.getByPlaceholderText('item-1'),
        );
      },
      { timeout: 100 },
    );
  });
});
