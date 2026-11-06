import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { useController } from '../../useController';
import { useForm } from '../../useForm';

describe('useForm with null values (issue #12815)', () => {
  function NumberInput({
    control,
    name = 'views',
  }: {
    control: any;
    name?: string;
  }) {
    const { field } = useController({
      name,
      control,
      defaultValue: null,
    });

    return (
      <input
        type="number"
        value={field.value ?? ''}
        onChange={(e) =>
          field.onChange(e.target.value ? Number(e.target.value) : null)
        }
        onBlur={field.onBlur}
        ref={field.ref}
        data-testid={name}
      />
    );
  }

  it('should submit null value when field is empty and untouched with useForm({ values })', async () => {
    let submittedData: any;

    function App() {
      const { control, handleSubmit } = useForm({
        values: { views: null as null | number },
      });

      return (
        <form
          onSubmit={handleSubmit((data) => {
            submittedData = data;
          })}
        >
          <NumberInput control={control} />
          <button type="submit">Submit</button>
        </form>
      );
    }

    render(<App />);

    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(submittedData).toEqual({ views: null });
    });
  });

  it('should submit null value after user clears the input', async () => {
    let submittedData: any;

    function App() {
      const { control, handleSubmit } = useForm({
        values: { views: null as null | number },
      });

      return (
        <form
          onSubmit={handleSubmit((data) => {
            submittedData = data;
          })}
        >
          <NumberInput control={control} />
          <button type="submit">Submit</button>
        </form>
      );
    }

    render(<App />);

    const input = screen.getByTestId('views') as HTMLInputElement;

    fireEvent.change(input, { target: { value: '42' } });
    fireEvent.change(input, { target: { value: '' } });

    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(submittedData).toEqual({ views: null });
    });
  });

  it('should work with defaultValues (not affected by the bug)', async () => {
    let submittedData: any;

    function App() {
      const { control, handleSubmit } = useForm({
        defaultValues: { views: null as null | number },
      });

      return (
        <form
          onSubmit={handleSubmit((data) => {
            submittedData = data;
          })}
        >
          <NumberInput control={control} />
          <button type="submit">Submit</button>
        </form>
      );
    }

    render(<App />);

    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(submittedData).toEqual({ views: null });
    });
  });

  it('should handle multiple fields with null values', async () => {
    let submittedData: any;

    function App() {
      const { control, handleSubmit } = useForm({
        values: {
          views: null as null | number,
          likes: null as null | number,
          shares: null as null | number,
        },
      });

      return (
        <form
          onSubmit={handleSubmit((data) => {
            submittedData = data;
          })}
        >
          <NumberInput control={control} name="views" />
          <NumberInput control={control} name="likes" />
          <NumberInput control={control} name="shares" />
          <button type="submit">Submit</button>
        </form>
      );
    }

    render(<App />);

    const likesInput = screen.getByTestId('likes');
    fireEvent.change(likesInput, { target: { value: '100' } });

    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(submittedData).toEqual({
        views: null,
        likes: 100,
        shares: null,
      });
    });
  });

  it('should prioritize values over defaultValues when both are set', async () => {
    let submittedData: any;

    function App() {
      const { control, handleSubmit } = useForm({
        defaultValues: { views: 100 as null | number },
        values: { views: null as null | number },
      });

      return (
        <form
          onSubmit={handleSubmit((data) => {
            submittedData = data;
          })}
        >
          <NumberInput control={control} />
          <button type="submit">Submit</button>
        </form>
      );
    }

    render(<App />);

    const input = screen.getByTestId('views') as HTMLInputElement;

    expect(input.value).toBe('');

    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(submittedData).toEqual({ views: null });
    });
  });

  it('should work with nested null values', async () => {
    let submittedData: any;

    function App() {
      const { register, handleSubmit } = useForm({
        values: {
          user: {
            name: 'John',
            age: null,
            email: null,
          },
        },
      });

      return (
        <form
          onSubmit={handleSubmit((data) => {
            submittedData = data;
          })}
        >
          <input {...register('user.name')} />
          <input {...register('user.age')} />
          <input {...register('user.email')} />
          <button type="submit">Submit</button>
        </form>
      );
    }

    render(<App />);

    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(submittedData).toEqual({
        user: {
          name: 'John',
          age: null,
          email: null,
        },
      });
    });
  });
});
