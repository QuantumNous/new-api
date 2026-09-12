import React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { useParams } from 'react-router-dom';

let renderCount = 0;

type FormInputs = {
  data: { name: string }[];
};

const WatchUseFieldArray: React.FC = () => {
  const { mode } = useParams();
  const { control, handleSubmit, reset, watch, register } = useForm<FormInputs>(
    {
      ...(mode === 'default'
        ? {
            defaultValues: {
              data: [{ name: 'test' }, { name: 'test1' }, { name: 'test2' }],
            },
          }
        : {}),
      mode: mode === 'formState' ? 'onChange' : 'onSubmit',
    },
  );
  const { fields, append, prepend, swap, move, insert, remove, update } =
    useFieldArray({
      control,
      name: 'data',
    });
  const onSubmit = () => {};
  const watchAll = watch('data') || [];

  React.useEffect(() => {
    setTimeout(() => {
      if (mode === 'asyncReset') {
        reset({
          data: [{ name: 'test' }, { name: 'test1' }, { name: 'test2' }],
        });
      }
    }, 10);
  }, [reset, mode]);

  renderCount++;

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <ul>
        {fields.map((data, index) => (
          <li key={data.id}>
            <input
              id={`field${index}`}
              data-order={index}
              {...register(`data.${index}.name` as const)}
            />
            <button id={`delete${index}`} onClick={() => remove(index)}>
              Delete
            </button>
          </li>
        ))}
      </ul>

      <button
        id="append"
        type="button"
        onClick={() => append({ name: renderCount.toString() })}
      >
        append
      </button>

      <button
        id="prepend"
        type="button"
        onClick={() => prepend({ name: renderCount.toString() })}
      >
        prepend
      </button>

      <button
        id="update"
        type="button"
        onClick={() => update(3, { name: 'updated value' })}
      >
        append
      </button>

      <button id="swap" onClick={() => swap(1, 2)} type="button">
        swap
      </button>

      <button id="move" onClick={() => move(2, 0)} type="button">
        move
      </button>

      <button
        id="insert"
        type="button"
        onClick={() => insert(1, { name: renderCount.toString() })}
      >
        insert
      </button>

      <button id="remove" type="button" onClick={() => remove(1)}>
        remove
      </button>

      <button id="removeAll" type="button" onClick={() => remove()}>
        remove all
      </button>

      <div id="renderCount">{renderCount}</div>
      <div id="result">{JSON.stringify(watchAll)}</div>
    </form>
  );
};

export default WatchUseFieldArray;
