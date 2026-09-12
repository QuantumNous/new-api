import React from 'react';
import { useForm } from 'react-hook-form';

function Reset() {
  const { register, reset } = useForm<{
    firstName: string;
    lastName: string;
    objectData: {
      test: string;
    };
    array: string[];
    deepNest: {
      level1: {
        level2: {
          data: string;
        };
      };
    };
  }>();
  return (
    <>
      <input {...register('firstName')} />
      <input {...register('array.1')} />
      <input {...register('objectData.test')} />
      <input {...register('lastName')} />
      <input {...register('deepNest.level1.level2.data')} />
      <button
        type="button"
        onClick={() =>
          reset({
            firstName: 'bill',
            lastName: 'luo',
            array: ['', 'test'],
            objectData: { test: 'data' },
            deepNest: {
              level1: {
                level2: {
                  data: 'hey',
                },
              },
            },
          })
        }
      >
        button
      </button>
    </>
  );
}

export default Reset;
