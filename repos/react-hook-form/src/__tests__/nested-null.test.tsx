import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { useForm } from '../useForm';

describe('nested null bug', () => {
  it('should not keep parent as null and allow nested value', async () => {
    function TestComponent() {
      const { register, handleSubmit } = useForm<{
        example: { inner?: string } | null;
      }>({
        defaultValues: {
          example: null,
        },
      });

      return (
        <form onSubmit={handleSubmit(onSubmit)}>
          <input {...register('example.inner')} />
          <button type="submit">Submit</button>
        </form>
      );
    }
    const onSubmit = jest.fn();
    render(<TestComponent />);

    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        { example: { inner: '' } },
        expect.anything(),
      );
    });
  });

  it('should not throw when unregistering nested field with null parent', () => {
    function TestComponent() {
      const { register, unregister } = useForm<{
        example: { nested?: { deep?: string } } | null;
      }>({
        defaultValues: {
          example: null,
        },
        shouldUnregister: false,
      });

      return (
        <form>
          <input {...register('example.nested.deep')} />
          <button
            type="button"
            onClick={() => unregister('example.nested.deep')}
          >
            Unregister
          </button>
        </form>
      );
    }
    render(<TestComponent />);

    expect(() => {
      fireEvent.click(screen.getByText('Unregister'));
    }).not.toThrow();
  });
});
