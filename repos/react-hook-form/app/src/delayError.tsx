import { useForm } from 'react-hook-form';
import React from 'react';

export function DelayError() {
  const {
    register,
    reset,
    formState: { errors },
  } = useForm({
    delayError: 100,
    mode: 'onChange',
    defaultValues: {
      first: '',
      last: '',
    },
  });
  return (
    <form>
      <input
        {...register('first', {
          maxLength: {
            value: 1,
            message: 'First too long.',
          },
        })}
        placeholder="First field"
      />
      {errors.first?.message && <p>{errors.first?.message}</p>}
      <input
        autoComplete="off"
        {...register('last', {
          maxLength: {
            value: 5,
            message: 'Last too long.',
          },
          minLength: {
            value: 2,
            message: 'Last too long.',
          },
        })}
        placeholder="Last field"
      />
      {errors.last?.message && <p>{errors.last?.message}</p>}
      <button
        type={'button'}
        onClick={() =>
          reset({
            first: '',
            last: '',
          })
        }
      >
        reset
      </button>
    </form>
  );
}
