import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { useFieldArray } from '../../useFieldArray';
import { useForm } from '../../useForm';
import noop from '../../utils/noop';

describe('useFieldArray focus', () => {
  it('should not focus any element when shouldFocus is set to false', () => {
    const Component = () => {
      const { register, control } = useForm<{
        test: { value: string }[];
      }>({
        defaultValues: {
          test: [{ value: '1' }, { value: '2' }],
        },
      });
      const { fields, prepend, append, insert } = useFieldArray({
        name: 'test',
        control,
      });

      return (
        <form>
          {fields.map((field, i) => (
            <input key={field.id} {...register(`test.${i}.value` as const)} />
          ))}
          <button
            type="button"
            onClick={() => prepend({ value: '' }, { shouldFocus: false })}
          >
            prepend
          </button>
          <button
            type="button"
            onClick={() => append({ value: '' }, { shouldFocus: false })}
          >
            append
          </button>
          <button
            type="button"
            onClick={() => insert(1, { value: '' }, { shouldFocus: false })}
          >
            insert
          </button>
        </form>
      );
    };

    render(<Component />);

    fireEvent.click(screen.getByRole('button', { name: /append/i }));

    fireEvent.click(screen.getByRole('button', { name: /prepend/i }));

    fireEvent.click(screen.getByRole('button', { name: /insert/i }));

    expect(document.activeElement).toEqual(document.body);
  });

  it('should focus on the precise input index', () => {
    function App() {
      const { register, handleSubmit, control } = useForm({
        defaultValues: {
          test: [
            { value: '0' },
            { value: '0' },
            { value: '0' },
            { value: '0' },
            { value: '0' },
            { value: '0' },
            { value: '0' },
            { value: '0' },
            { value: '0' },
            { value: '0' },
            { value: '0' },
            { value: '0' },
          ],
        },
      });
      const { fields, insert } = useFieldArray({ control, name: 'test' });

      return (
        <form onSubmit={handleSubmit(noop)}>
          {fields.map((field, index) => (
            <div key={field.id}>
              <input
                {...register(`test.${index}.value`)}
                defaultValue={field.value}
              />
              <button onClick={() => insert(1, { value: '' })}>insert</button>
            </div>
          ))}
        </form>
      );
    }

    render(<App />);

    fireEvent.click(screen.getAllByRole('button', { name: /insert/i })[0]);

    expect(document.activeElement).toEqual(screen.getAllByRole('textbox')[1]);
  });

  it('should focus correct field array by focus index', () => {
    const Component = () => {
      const { register, control } = useForm<{
        test: { value: string }[];
      }>({
        defaultValues: {
          test: [{ value: '1' }, { value: '2' }],
        },
      });
      const { fields, prepend, append, insert } = useFieldArray({
        name: 'test',
        control,
      });

      return (
        <form>
          {fields.map((field, i) => (
            <input key={field.id} {...register(`test.${i}.value` as const)} />
          ))}
          <button
            type="button"
            onClick={() => prepend({ value: '' }, { focusIndex: 1 })}
          >
            prepend
          </button>
          <button
            type="button"
            onClick={() => append({ value: '' }, { focusIndex: 0 })}
          >
            append
          </button>
          <button
            type="button"
            onClick={() => insert(1, { value: '' }, { focusIndex: 0 })}
          >
            insert
          </button>
        </form>
      );
    };

    render(<Component />);

    fireEvent.click(screen.getByRole('button', { name: /append/i }));

    expect(document.activeElement).toEqual(screen.getAllByRole('textbox')[0]);

    fireEvent.click(screen.getByRole('button', { name: /prepend/i }));

    expect(document.activeElement).toEqual(screen.getAllByRole('textbox')[1]);

    fireEvent.click(screen.getByRole('button', { name: /insert/i }));

    expect(document.activeElement).toEqual(screen.getAllByRole('textbox')[0]);
  });

  it('should focus correct field array by focus name', () => {
    const Component = () => {
      const { register, control } = useForm<{
        test: { value: string }[];
      }>({
        defaultValues: {
          test: [{ value: '1' }, { value: '2' }],
        },
      });
      const { fields, prepend, append, insert } = useFieldArray({
        name: 'test',
        control,
      });

      return (
        <form>
          {fields.map((field, i) => (
            <input key={field.id} {...register(`test.${i}.value` as const)} />
          ))}
          <button
            type="button"
            onClick={() =>
              prepend({ value: '' }, { focusName: 'test.1.value' })
            }
          >
            prepend
          </button>
          <button
            type="button"
            onClick={() => append({ value: '' }, { focusName: 'test.0.value' })}
          >
            append
          </button>
          <button
            type="button"
            onClick={() =>
              insert(1, { value: '' }, { focusName: 'test.0.value' })
            }
          >
            insert
          </button>
        </form>
      );
    };

    render(<Component />);

    fireEvent.click(screen.getByRole('button', { name: /append/i }));

    expect(document.activeElement).toEqual(screen.getAllByRole('textbox')[0]);

    fireEvent.click(screen.getByRole('button', { name: /prepend/i }));

    expect(document.activeElement).toEqual(screen.getAllByRole('textbox')[1]);

    fireEvent.click(screen.getByRole('button', { name: /insert/i }));

    expect(document.activeElement).toEqual(screen.getAllByRole('textbox')[0]);
  });
});
