import React from 'react';
import { useForm } from 'react-hook-form';

function ResetKeepDirty() {
  const { register, reset, setValue, watch } = useForm<{
    firstName: string;
    lastName: string;
    objectData: {
      test: string;
    };
    users: { firstName: string; lastName: string }[];
    deepNest: {
      level1: {
        level2: {
          data: string;
        };
      };
    };
  }>({
    defaultValues: { users: [] },
  });
  const users = watch('users');
  return (
    <>
      <input {...register('firstName')} />
      <input name="users" value={`users#${users.length}`} />
      <input {...register('objectData.test')} />
      <input {...register('lastName')} />
      <input {...register('deepNest.level1.level2.data')} />
      <button
        onClick={() => {
          setValue(
            'users',
            [...users, { firstName: 'John', lastName: 'Doe' }],
            { shouldDirty: true },
          );
        }}
        type="button"
      >
        Add item
      </button>
      <button
        type="button"
        onClick={() =>
          reset(
            {
              firstName: 'bill',
              lastName: 'luo',
              objectData: { test: 'data' },
              deepNest: {
                level1: {
                  level2: {
                    data: 'hey',
                  },
                },
              },
              users: [],
            },
            { keepDirtyValues: true },
          )
        }
      >
        button
      </button>
    </>
  );
}

export default ResetKeepDirty;
