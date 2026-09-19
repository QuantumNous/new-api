import React from 'react';
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';

import { useForm } from '../../useForm';

describe('unregister', () => {
  it('should unregister an registered item', async () => {
    const { result } = renderHook(() => useForm<{ input: string }>());

    result.current.register('input');

    await act(async () => {
      await result.current.unregister('input');
    });

    expect(result.current.getValues()).toEqual({});
  });

  it('should unregister an registered item with array name', async () => {
    const { result } = renderHook(() =>
      useForm<{
        input: string;
        input2: string;
      }>(),
    );

    result.current.register('input');
    result.current.register('input');
    result.current.register('input2');

    await act(async () => {
      await result.current.unregister(['input', 'input2']);
    });

    expect(result.current.getValues()).toEqual({});
  });

  it('should unregister all inputs', async () => {
    const { result } = renderHook(() =>
      useForm<{
        input: string;
        input2: string;
      }>(),
    );

    result.current.register('input');
    result.current.register('input');
    result.current.register('input2');

    await act(async () => {
      await result.current.unregister();
    });

    expect(result.current.getValues()).toEqual({});
  });

  it('should recompute isDirty after a field is unregistered and re-registered back to its default value (#13397)', async () => {
    let isDirty: boolean | null = null;

    const App = () => {
      const { register, watch, formState } = useForm({
        defaultValues: { showName: true, name: 'default' },
        shouldUnregister: true,
      });
      isDirty = formState.isDirty;
      const showName = watch('showName');

      return (
        <form>
          <input type="checkbox" {...register('showName')} />
          {showName && <input type="text" {...register('name')} />}
        </form>
      );
    };

    render(<App />);

    const checkbox = screen.getByRole('checkbox');

    fireEvent.click(checkbox);
    await waitFor(() => expect(isDirty).toBe(true));

    fireEvent.click(checkbox);
    await waitFor(() => expect(isDirty).toBe(false));
  });

  it('should not flip isDirty to true when a field with no defaultValue is registered from useEffect', async () => {
    let isDirty: boolean | null = null;

    const App = () => {
      const {
        register,
        formState: { isDirty: isDirtyState },
      } = useForm<{ firstName: string; lastName: string }>();

      isDirty = isDirtyState;

      React.useEffect(() => {
        register('firstName');
        register('lastName');
      }, [register]);

      return <form />;
    };

    render(<App />);

    await waitFor(() => expect(isDirty).toBe(false));
  });
});
