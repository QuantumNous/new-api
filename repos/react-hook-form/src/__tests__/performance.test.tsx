import React from 'react';
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';

import type { Control } from '../types';
import { useForm } from '../useForm';
import { useWatch } from '../useWatch';

function changeEmits(spy: jest.SpyInstance): Record<string, unknown>[] {
  return spy.mock.calls
    .map(([payload]) => payload)
    .filter(
      (p): p is Record<string, unknown> =>
        p != null && typeof p === 'object' && 'type' in p,
    );
}

describe('onChange value-clone optimization', () => {
  it('emits without a values key when no value subscribers are active', () => {
    let control: any;

    function Form() {
      const { register, control: c } = useForm({
        defaultValues: { name: '' },
      });
      control = c;
      return <input {...register('name')} data-testid="name" />;
    }

    render(<Form />);

    const nextSpy = jest.spyOn(control._subjects.state, 'next');

    fireEvent.change(screen.getByTestId('name'), { target: { value: 'a' } });
    fireEvent.change(screen.getByTestId('name'), { target: { value: 'b' } });
    fireEvent.change(screen.getByTestId('name'), { target: { value: 'c' } });

    const emits = changeEmits(nextSpy);
    expect(emits.length).toBeGreaterThan(0);
    expect(emits.every((p) => !('values' in p))).toBe(true);
  });

  it('emits a values key when watch(fn) is active', async () => {
    let control: any;

    function Form() {
      const {
        register,
        watch,
        control: c,
      } = useForm({
        defaultValues: { name: '' },
      });
      control = c;
      React.useEffect(() => {
        const sub = watch(() => {});
        return () => sub.unsubscribe();
      }, [watch]);
      return <input {...register('name')} data-testid="name" />;
    }

    render(<Form />);

    const nextSpy = jest.spyOn(control._subjects.state, 'next');

    fireEvent.change(screen.getByTestId('name'), { target: { value: 'x' } });

    const emits = changeEmits(nextSpy);
    expect(emits.some((p) => 'values' in p)).toBe(true);
  });

  it('emits a values key when useWatch is mounted', () => {
    let control: any;

    function Watcher({ ctrl }: { ctrl: Control<{ name: string }> }) {
      useWatch({ control: ctrl });
      return null;
    }

    function Form() {
      const { register, control: c } = useForm({
        defaultValues: { name: '' },
      });
      control = c;
      return (
        <>
          <Watcher ctrl={c} />
          <input {...register('name')} data-testid="name" />
        </>
      );
    }

    render(<Form />);

    const nextSpy = jest.spyOn(control._subjects.state, 'next');

    fireEvent.change(screen.getByTestId('name'), { target: { value: 'x' } });

    const emits = changeEmits(nextSpy);
    expect(emits.some((p) => 'values' in p)).toBe(true);
  });

  it('stops emitting values after watch(fn) unsubscribes', async () => {
    let control: any;
    let unsubscribeWatch: () => void;

    function Form() {
      const {
        register,
        watch,
        control: c,
      } = useForm({
        defaultValues: { name: '' },
      });
      control = c;
      React.useEffect(() => {
        const sub = watch(() => {});
        unsubscribeWatch = () => sub.unsubscribe();
      }, [watch]);
      return <input {...register('name')} data-testid="name" />;
    }

    render(<Form />);

    act(() => {
      unsubscribeWatch!();
    });

    const nextSpy = jest.spyOn(control._subjects.state, 'next');

    fireEvent.change(screen.getByTestId('name'), {
      target: { value: 'after' },
    });

    const emits = changeEmits(nextSpy);
    expect(emits.length).toBeGreaterThan(0);
    expect(emits.every((p) => !('values' in p))).toBe(true);
  });
});

describe('Throughput', () => {
  const BUDGET_MS = 3_000;

  it('handles 500 onChange events on a single field within budget', () => {
    function Form() {
      const { register } = useForm({ defaultValues: { a: '' } });
      return <input {...register('a')} data-testid="a" />;
    }

    render(<Form />);
    const input = screen.getByTestId('a');

    const t0 = performance.now();
    for (let i = 0; i < 500; i++) {
      fireEvent.change(input, { target: { value: String(i) } });
    }
    expect(performance.now() - t0).toBeLessThan(BUDGET_MS);
  });

  it('handles one change per field on a 50-field form within budget', () => {
    const names = Array.from({ length: 50 }, (_, i) => `f${i}`);

    function Form() {
      const { register } = useForm({
        defaultValues: Object.fromEntries(names.map((n) => [n, ''])) as Record<
          string,
          string
        >,
      });
      return (
        <form>
          {names.map((n) => (
            <input key={n} {...register(n as any)} data-testid={n} />
          ))}
        </form>
      );
    }

    render(<Form />);

    const t0 = performance.now();
    for (const n of names) {
      fireEvent.change(screen.getByTestId(n), { target: { value: 'x' } });
    }
    expect(performance.now() - t0).toBeLessThan(BUDGET_MS);
  });

  it('handles 500 onChange events with an active watch(fn) subscriber within budget', async () => {
    function Form() {
      const { register, watch } = useForm({ defaultValues: { a: '' } });
      React.useEffect(() => {
        const sub = watch(() => {});
        return () => sub.unsubscribe();
      }, [watch]);
      return <input {...register('a')} data-testid="a" />;
    }

    render(<Form />);
    const input = screen.getByTestId('a');

    const t0 = performance.now();
    for (let i = 0; i < 500; i++) {
      fireEvent.change(input, { target: { value: String(i) } });
    }
    expect(performance.now() - t0).toBeLessThan(BUDGET_MS);
  });

  it('runs trigger() on a 50-field form with required validation within budget', async () => {
    const names = Array.from({ length: 50 }, (_, i) => `f${i}`);

    const { result } = renderHook(() =>
      useForm({
        defaultValues: Object.fromEntries(names.map((n) => [n, ''])) as Record<
          string,
          string
        >,
      }),
    );

    for (const n of names) {
      result.current.register(n as any, { required: true });
    }

    const t0 = performance.now();
    await act(async () => {
      await result.current.trigger();
    });
    expect(performance.now() - t0).toBeLessThan(BUDGET_MS);
  });
});

describe('_getDirty optimization', () => {
  const BUDGET_MS = 3_000;

  it('tracks isDirty efficiently when multiple fields stay dirty (O(1) fast path)', () => {
    const names = Array.from({ length: 50 }, (_, i) => `f${i}`);

    function Form() {
      const { register, formState } = useForm({
        defaultValues: Object.fromEntries(names.map((n) => [n, ''])) as Record<
          string,
          string
        >,
      });
      void formState.isDirty;
      return (
        <form>
          {names.map((n) => (
            <input key={n} {...register(n as any)} data-testid={n} />
          ))}
        </form>
      );
    }

    render(<Form />);

    // Dirty all fields except f0 so dirtyFields is never empty during the loop.
    // This keeps the fast path active: !isEmptyObject(dirtyFields) → skip _getDirty().
    for (let i = 1; i < names.length; i++) {
      fireEvent.change(screen.getByTestId(`f${i}`), {
        target: { value: 'dirty' },
      });
    }

    const t0 = performance.now();
    for (let i = 0; i < 500; i++) {
      fireEvent.change(screen.getByTestId('f0'), {
        target: { value: String(i) },
      });
    }
    expect(performance.now() - t0).toBeLessThan(BUDGET_MS);
  });

  it('surfaces untracked setValue fields in dirtyFields when the last tracked field goes pristine', async () => {
    let capturedDirtyFields: Record<string, unknown> = {};
    let capturedIsDirty = false;

    function Form() {
      const { register, setValue, formState } = useForm({
        defaultValues: { a: '', b: '' },
      });
      capturedDirtyFields = formState.dirtyFields;
      capturedIsDirty = formState.isDirty;
      React.useEffect(() => {
        setValue('a', 'changed');
      }, [setValue]);
      return (
        <form>
          <input {...register('a')} data-testid="a" />
          <input {...register('b')} data-testid="b" />
        </form>
      );
    }

    render(<Form />);

    // Make b dirty then restore it — the only tracked-dirty field goes pristine.
    // _getDirty() fallback must detect 'a' (changed via setValue) and rebuild
    // dirtyFields so 'a' appears there.
    await act(async () => {
      fireEvent.change(screen.getByTestId('b'), { target: { value: 'x' } });
    });
    await act(async () => {
      fireEvent.change(screen.getByTestId('b'), { target: { value: '' } });
    });

    expect(capturedIsDirty).toBe(true);
    expect(capturedDirtyFields).toHaveProperty('a');
  });
});

describe('isDirty proxy guard', () => {
  it('does not include isDirty in state notification when nothing subscribes to isDirty', () => {
    let control: any;

    function Form() {
      const { register, control: c } = useForm({
        defaultValues: { name: 'default' },
      });
      control = c;
      return <input {...register('name')} data-testid="name" />;
    }

    render(<Form />);

    const nextSpy = jest.spyOn(control._subjects.state, 'next');

    fireEvent.change(screen.getByTestId('name'), { target: { value: 'x' } });

    const emits = nextSpy.mock.calls.map(([p]) => p);
    expect(emits.every((p: any) => !('isDirty' in p))).toBe(true);
  });

  it('includes isDirty in state notification when subscribed', async () => {
    let control: any;

    function Form() {
      const {
        register,
        formState,
        control: c,
      } = useForm({
        defaultValues: { name: 'default' },
      });
      control = c;
      void formState.isDirty;
      return <input {...register('name')} data-testid="name" />;
    }

    render(<Form />);

    const nextSpy = jest.spyOn(control._subjects.state, 'next');

    fireEvent.change(screen.getByTestId('name'), { target: { value: 'x' } });

    const emits = nextSpy.mock.calls.map(([p]) => p);
    expect(emits.some((p: any) => 'isDirty' in p && p.isDirty === true)).toBe(
      true,
    );
  });
});

describe('_setValid optimization', () => {
  const BUDGET_MS = 3_000;

  it('skips full re-validation on no-rule fields when form is valid (500 changes within budget)', () => {
    const names = Array.from({ length: 50 }, (_, i) => `f${i}`);

    function Form() {
      const { register, formState } = useForm({
        defaultValues: Object.fromEntries(names.map((n) => [n, ''])) as Record<
          string,
          string
        >,
      });
      void formState.isValid;
      return (
        <form>
          {names.map((n) => (
            <input key={n} {...register(n as any)} data-testid={n} />
          ))}
        </form>
      );
    }

    render(<Form />);

    // Form starts valid (no rules on any field). 500 changes should skip
    // executeBuiltInValidation entirely and complete well within budget.
    const t0 = performance.now();
    for (let i = 0; i < 500; i++) {
      fireEvent.change(screen.getByTestId('f0'), {
        target: { value: String(i) },
      });
    }
    expect(performance.now() - t0).toBeLessThan(BUDGET_MS);
  });

  it('updates isValid correctly when a no-rule field change unmounts an invalid required field', async () => {
    let capturedIsValid = false;

    function Form() {
      const { register, control, formState } = useForm({
        mode: 'all',
        defaultValues: { toggle: false, required: '' },
      });
      capturedIsValid = formState.isValid;
      const toggleValue = useWatch({ control, name: 'toggle' });
      return (
        <form>
          <input type="checkbox" {...register('toggle')} data-testid="toggle" />
          {toggleValue && (
            <input
              {...register('required', { required: true })}
              data-testid="required"
            />
          )}
        </form>
      );
    }

    render(<Form />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('toggle'));
    });

    await waitFor(() => expect(capturedIsValid).toBe(false));

    await act(async () => {
      fireEvent.click(screen.getByTestId('toggle'));
    });

    await waitFor(() => expect(capturedIsValid).toBe(true));
  });
});

describe('Re-render efficiency', () => {
  it('does not re-render the form parent when a child useWatch re-renders', () => {
    let parentRenders = 0;
    let childRenders = 0;

    const Child = ({
      control,
    }: {
      control: Control<{ a: string; b: string }>;
    }) => {
      useWatch({ control, name: 'a' });
      childRenders++;
      return <div />;
    };

    const Parent = () => {
      const { register, control } = useForm({
        defaultValues: { a: '', b: '' },
      });
      parentRenders++;
      return (
        <>
          <Child control={control} />
          <input {...register('a')} data-testid="a" />
          <input {...register('b')} data-testid="b" />
        </>
      );
    };

    render(<Parent />);

    const pBefore = parentRenders;
    const cBefore = childRenders;

    fireEvent.change(screen.getByTestId('a'), { target: { value: 'changed' } });

    expect(childRenders - cBefore).toBeGreaterThan(0);
    expect(parentRenders - pBefore).toBe(0);
  });

  it('does not re-render a useWatch component when an unwatched field changes', () => {
    let watcherRenders = 0;

    const Watcher = ({
      control,
    }: {
      control: Control<{ a: string; b: string }>;
    }) => {
      useWatch({ control, name: 'a' });
      watcherRenders++;
      return <div />;
    };

    const Parent = () => {
      const { register, control } = useForm({
        defaultValues: { a: '', b: '' },
      });
      return (
        <>
          <Watcher control={control} />
          <input {...register('a')} data-testid="a" />
          <input {...register('b')} data-testid="b" />
        </>
      );
    };

    render(<Parent />);
    const before = watcherRenders;

    fireEvent.change(screen.getByTestId('b'), { target: { value: 'x' } });

    expect(watcherRenders - before).toBe(0);
  });
});

describe('setValues emission batching', () => {
  it('emits exactly one state notification regardless of how many fields change', async () => {
    const names = Array.from({ length: 20 }, (_, i) => `f${i}`);

    const { result } = renderHook(() =>
      useForm({
        defaultValues: Object.fromEntries(names.map((n) => [n, ''])) as Record<
          string,
          string
        >,
      }),
    );

    for (const n of names) {
      result.current.register(n as any);
    }

    let emitCount = 0;
    const sub = (result.current as any).control._subjects.state.subscribe({
      next: () => emitCount++,
    });

    await act(async () => {
      result.current.setValues(
        Object.fromEntries(names.map((n) => [n, 'x'])) as any,
      );
    });

    sub.unsubscribe();

    expect(emitCount).toBe(1);
  });

  it('delivers correct values and dirty state after batched setValues', async () => {
    let capturedDirtyFields: Record<string, unknown> = {};

    function Form() {
      const { register, setValues, formState } = useForm({
        defaultValues: { a: '', b: '', c: '' },
      });
      capturedDirtyFields = formState.dirtyFields;
      React.useEffect(() => {
        register('a');
        register('b');
        register('c');
      }, [register]);
      return (
        <button
          onClick={() =>
            setValues({ a: 'x', b: 'y', c: '' }, { shouldDirty: true })
          }
        >
          set
        </button>
      );
    }

    render(<Form />);

    await act(async () => {
      fireEvent.click(screen.getByText('set'));
    });

    expect(capturedDirtyFields).toHaveProperty('a');
    expect(capturedDirtyFields).toHaveProperty('b');
    expect(capturedDirtyFields).not.toHaveProperty('c');
  });
});

describe('setValues _valuesSubscriberCount guard', () => {
  it('omits values from the broadcast when no watch(fn) subscriber is active', async () => {
    const { result } = renderHook(() =>
      useForm({ defaultValues: { a: '', b: '' } }),
    );

    result.current.register('a' as any);
    result.current.register('b' as any);

    const control = result.current.control as any;
    const nextSpy = jest.spyOn(control._subjects.state, 'next');

    await act(async () => {
      result.current.setValues({ a: 'x', b: 'y' } as any);
    });

    const emits = nextSpy.mock.calls.map(([p]) => p);
    expect(emits.every((p: any) => !('values' in p))).toBe(true);
  });

  it('includes values in the broadcast when a watch(fn) subscriber is active', async () => {
    const { result } = renderHook(() =>
      useForm({ defaultValues: { a: '', b: '' } }),
    );

    result.current.register('a' as any);
    result.current.register('b' as any);

    const watchSub = result.current.watch(() => {});
    const control = result.current.control as any;
    const nextSpy = jest.spyOn(control._subjects.state, 'next');

    await act(async () => {
      result.current.setValues({ a: 'x', b: 'y' } as any);
    });

    watchSub.unsubscribe();

    const emits = nextSpy.mock.calls.map(([p]) => p);
    expect(emits.some((p: any) => 'values' in p)).toBe(true);
  });
});

describe('_valuesSubscriberCount idempotency', () => {
  it('does not go negative when watch(fn) unsubscribe is called twice', () => {
    let control: any;
    let watchFn: any;

    function Form() {
      const {
        register,
        watch,
        control: c,
      } = useForm({
        defaultValues: { name: '' },
      });
      control = c;
      watchFn = watch;
      return <input {...register('name')} data-testid="name" />;
    }

    render(<Form />);

    const sub = watchFn(() => {});
    sub.unsubscribe();
    sub.unsubscribe();

    const nextSpy = jest.spyOn(control._subjects.state, 'next');
    fireEvent.change(screen.getByTestId('name'), { target: { value: 'x' } });

    const emits = nextSpy.mock.calls
      .map(([p]: [any]) => p)
      .filter((p: any) => p != null && typeof p === 'object' && 'type' in p);
    expect(emits.length).toBeGreaterThan(0);
    expect(emits.every((p: any) => !('values' in p))).toBe(true);
  });
});
