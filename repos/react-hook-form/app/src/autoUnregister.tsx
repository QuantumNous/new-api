import React, { useState } from 'react';
import ReactSelect from 'react-select';
import { useForm, Controller } from 'react-hook-form';

const options = [
  { value: 'chocolate', label: 'Chocolate' },
  { value: 'strawberry', label: 'Strawberry' },
  { value: 'vanilla', label: 'Vanilla' },
];

export default function AutoUnregister() {
  const { register, control, handleSubmit } = useForm<{
    test: string;
    test1: string;
    test2: boolean;
    test3: string;
    test4: string;
    ReactSelect: { label: string; value: string };
  }>();
  const [show, setShow] = useState(true);

  return (
    <form onSubmit={handleSubmit((d) => console.log(d))}>
      {show && (
        <>
          <Controller
            defaultValue=""
            control={control}
            render={({ field }) => <input {...field} />}
            name="test"
          />
          <section id="input-ReactSelect">
            <Controller
              render={({ field }) => (
                <ReactSelect isClearable options={options} {...field} />
              )}
              name="ReactSelect"
              control={control}
              rules={{ required: true }}
            />
          </section>

          <input {...register('test1')} />
          <input type="checkbox" {...register('test2')} />
          <input type="radio" {...register('test3')} />
          <select {...register('test4')}>
            <option>Select...</option>
            <option value="bill">Bill</option>
          </select>
        </>
      )}

      <button type="button" onClick={() => setShow(!show)}>
        Toggle Modal
      </button>

      <input type="submit" />
    </form>
  );
}
