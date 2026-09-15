import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import { useForm } from '../../useForm';

jest.useFakeTimers();

describe('resetDefaultValues', () => {
  it('should update default values and recompute dirtyFields/isDirty without changing form values', async () => {
    let formRef: ReturnType<
      typeof useForm<{ firstName: string; lastName: string }>
    >;

    const App = () => {
      const methods = useForm({
        defaultValues: { firstName: 'John', lastName: 'Doe' },
      });
      formRef = methods;
      const {
        register,
        formState: { isDirty, dirtyFields },
      } = methods;
      return (
        <form>
          <input {...register('firstName')} placeholder="firstName" />
          <input {...register('lastName')} placeholder="lastName" />
          <p data-testid="isDirty">{isDirty ? 'dirty' : 'clean'}</p>
          <p data-testid="dirtyFields">{JSON.stringify(dirtyFields)}</p>
        </form>
      );
    };

    render(<App />);

    // Change firstName so it's dirty
    fireEvent.change(screen.getByPlaceholderText('firstName'), {
      target: { value: 'Jane' },
    });

    expect(screen.getByTestId('isDirty').textContent).toBe('dirty');
    expect(screen.getByTestId('dirtyFields').textContent).toBe(
      '{"firstName":true}',
    );

    // Reset default values to match the current "Jane" value
    act(() => {
      formRef.resetDefaultValues({ firstName: 'Jane', lastName: 'Doe' });
    });

    // The input value should not change
    expect(
      (screen.getByPlaceholderText('firstName') as HTMLInputElement).value,
    ).toBe('Jane');

    // isDirty and dirtyFields should be recomputed: firstName is no longer dirty
    expect(screen.getByTestId('isDirty').textContent).toBe('clean');
    expect(screen.getByTestId('dirtyFields').textContent).toBe('{}');
  });

  it('should keep dirty state when keepDirty option is true', async () => {
    let formRef: ReturnType<typeof useForm<{ firstName: string }>>;

    const App = () => {
      const methods = useForm({ defaultValues: { firstName: 'John' } });
      formRef = methods;
      const {
        register,
        formState: { isDirty, dirtyFields },
      } = methods;
      return (
        <form>
          <input {...register('firstName')} placeholder="firstName" />
          <p data-testid="isDirty">{isDirty ? 'dirty' : 'clean'}</p>
          <p data-testid="dirtyFields">{JSON.stringify(dirtyFields)}</p>
        </form>
      );
    };

    render(<App />);

    fireEvent.change(screen.getByPlaceholderText('firstName'), {
      target: { value: 'Jane' },
    });

    expect(screen.getByTestId('isDirty').textContent).toBe('dirty');

    // Reset defaults to the new value but keep dirty state
    act(() => {
      formRef.resetDefaultValues({ firstName: 'Jane' }, { keepDirty: true });
    });

    // Input value should not change
    expect(
      (screen.getByPlaceholderText('firstName') as HTMLInputElement).value,
    ).toBe('Jane');

    // Dirty state should be preserved because keepDirty: true
    expect(screen.getByTestId('isDirty').textContent).toBe('dirty');
    expect(screen.getByTestId('dirtyFields').textContent).toBe(
      '{"firstName":true}',
    );
  });

  it('should update formState.defaultValues when resetDefaultValues is called', async () => {
    let formRef: ReturnType<typeof useForm<{ name: string }>>;

    const App = () => {
      const methods = useForm({ defaultValues: { name: 'initial' } });
      formRef = methods;
      const {
        register,
        formState: { defaultValues },
      } = methods;
      return (
        <form>
          <input {...register('name')} />
          <p data-testid="defaultValues">{JSON.stringify(defaultValues)}</p>
        </form>
      );
    };

    render(<App />);

    expect(screen.getByTestId('defaultValues').textContent).toBe(
      '{"name":"initial"}',
    );

    act(() => {
      formRef.resetDefaultValues({ name: 'updated' });
    });

    expect(screen.getByTestId('defaultValues').textContent).toBe(
      '{"name":"updated"}',
    );
  });

  it('should work with nested objects', async () => {
    let formRef: ReturnType<
      typeof useForm<{ user: { name: string; age: number } }>
    >;

    const App = () => {
      const methods = useForm({
        defaultValues: { user: { name: 'John', age: 30 } },
      });
      formRef = methods;
      const {
        register,
        formState: { isDirty, dirtyFields },
      } = methods;
      return (
        <form>
          <input {...register('user.name')} placeholder="name" />
          <input {...register('user.age')} placeholder="age" type="number" />
          <p data-testid="isDirty">{isDirty ? 'dirty' : 'clean'}</p>
          <p data-testid="dirtyFields">{JSON.stringify(dirtyFields)}</p>
        </form>
      );
    };

    render(<App />);

    fireEvent.change(screen.getByPlaceholderText('name'), {
      target: { value: 'Jane' },
    });

    expect(screen.getByTestId('dirtyFields').textContent).toContain(
      '"name":true',
    );

    // Reset defaults to the current user value (submitted state)
    act(() => {
      formRef.resetDefaultValues({ user: { name: 'Jane', age: 30 } });
    });

    expect(screen.getByTestId('isDirty').textContent).toBe('clean');
    expect(screen.getByTestId('dirtyFields').textContent).toBe('{}');

    // Input values should not change
    expect(
      (screen.getByPlaceholderText('name') as HTMLInputElement).value,
    ).toBe('Jane');
  });

  it('should recompute dirty fields correctly when some fields still differ from new defaults', async () => {
    let formRef: ReturnType<
      typeof useForm<{ a: string; b: string; c: string }>
    >;

    const App = () => {
      const methods = useForm({
        defaultValues: { a: '1', b: '2', c: '3' },
      });
      formRef = methods;
      const {
        register,
        formState: { isDirty, dirtyFields },
      } = methods;
      return (
        <form>
          <input {...register('a')} placeholder="a" />
          <input {...register('b')} placeholder="b" />
          <input {...register('c')} placeholder="c" />
          <p data-testid="isDirty">{isDirty ? 'dirty' : 'clean'}</p>
          <p data-testid="dirtyFields">{JSON.stringify(dirtyFields)}</p>
        </form>
      );
    };

    render(<App />);

    // Dirty all three fields
    fireEvent.change(screen.getByPlaceholderText('a'), {
      target: { value: 'A' },
    });
    fireEvent.change(screen.getByPlaceholderText('b'), {
      target: { value: 'B' },
    });
    fireEvent.change(screen.getByPlaceholderText('c'), {
      target: { value: 'C' },
    });

    await waitFor(() =>
      expect(screen.getByTestId('dirtyFields').textContent).toBe(
        '{"a":true,"b":true,"c":true}',
      ),
    );

    // Reset defaults so that 'a' matches the current value ('A'),
    // but 'b' and 'c' still differ
    act(() => {
      formRef.resetDefaultValues({ a: 'A', b: '2', c: '3' });
    });

    // 'a' is no longer dirty, 'b' and 'c' remain dirty
    expect(screen.getByTestId('isDirty').textContent).toBe('dirty');
    expect(JSON.parse(screen.getByTestId('dirtyFields').textContent!)).toEqual({
      b: true,
      c: true,
    });
  });
});
