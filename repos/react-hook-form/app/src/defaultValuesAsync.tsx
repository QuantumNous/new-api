import React from 'react';
import { useForm } from 'react-hook-form';

const sleep = <T,>(data: T, ms: number) =>
  new Promise<T>((res) => setTimeout(() => res(data), ms));

function DefaultValues() {
  const { register } = useForm({
    defaultValues: async () =>
      sleep(
        {
          test: 'test',
          checkbox: ['1', '2'],
          test1: {
            firstName: 'firstName',
            lastName: ['lastName0', 'lastName1'],
            deep: {
              nest: 'nest',
            },
          },
        },
        10,
      ),
  });
  const [show, setShow] = React.useState(true);

  return (
    <>
      {show ? (
        <form>
          <input {...register('test')} />
          <input {...register('test1.firstName')} />
          <input {...register('test1.deep.nest')} />
          <input {...register('test1.deep.nest')} />
          <input {...register('test1.lastName.0')} />
          <input {...register('test1.lastName.1')} />
          <input type="checkbox" value={'1'} {...register('checkbox')} />
          <input type="checkbox" value={'2'} {...register('checkbox')} />
        </form>
      ) : null}
      <button type={'button'} id={'toggle'} onClick={() => setShow(!show)}>
        toggle
      </button>
    </>
  );
}

export default DefaultValues;
