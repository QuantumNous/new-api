import React from 'react';
import { Controller, useFieldArray, useForm, Control } from 'react-hook-form';

type FormValues = {
  test: {
    firstName: string;
    lastName: string;
    keyValue: { name: string }[];
  }[];
};

function NestedArray({
  control,
  index,
}: {
  control: Control<FormValues>;
  index: number;
}) {
  const { fields, append, prepend, swap, move, remove, insert, update } =
    useFieldArray<FormValues, 'test.0.keyValue'>({
      name: `test.${index}.keyValue` as 'test.0.keyValue',
      control,
    });
  const renderCountRef = React.useRef(0);
  renderCountRef.current++;

  return (
    <div>
      <ul>
        {fields.map((item, i) => (
          <Controller
            key={item.id}
            render={({ field }) => <input {...field} aria-label={'name'} />}
            name={`test.${index}.keyValue.${i}.name`}
            control={control}
          />
        ))}
      </ul>

      <button
        id={`nest-append-${index}`}
        type="button"
        onClick={() => append({ name: 'append' })}
      >
        append
      </button>

      <button
        id={`nest-prepend-${index}`}
        type="button"
        onClick={() => prepend({ name: 'prepend' })}
      >
        prepend
      </button>

      <button
        id={`nest-update-${index}`}
        type="button"
        onClick={() => update(0, { name: 'billUpdate' })}
      >
        update
      </button>

      <button
        id={`nest-swap-${index}`}
        onClick={() => swap(1, 2)}
        type="button"
      >
        swap
      </button>

      <button
        id={`nest-move-${index}`}
        onClick={() => move(2, 0)}
        type="button"
      >
        move
      </button>

      <button
        id={`nest-insert-${index}`}
        type="button"
        onClick={() => insert(1, { name: 'insert' })}
      >
        insert
      </button>

      <button
        id={`nest-remove-${index}`}
        type="button"
        onClick={() => remove(1)}
      >
        remove
      </button>

      <button
        id={`nest-remove-all-${index}`}
        type="button"
        onClick={() => remove()}
      >
        remove all
      </button>

      <div id={`count-nest-${index}`}>{renderCountRef.current}</div>
    </div>
  );
}

export default () => {
  const { register, control, reset, setValue, handleSubmit, watch } =
    useForm<FormValues>({
      defaultValues: {
        test: [
          {
            firstName: 'Bill',
            lastName: 'Luo',
            keyValue: [{ name: '1a' }, { name: '1c' }],
          },
        ],
      },
    });
  const { fields, append, prepend, swap, move, insert, remove, update } =
    useFieldArray({
      control,
      name: 'test',
    });
  const renderCountRef = React.useRef(0);
  renderCountRef.current++;

  const result = watch('test');

  return (
    <form onSubmit={handleSubmit((e) => console.log(e))}>
      {fields.map((item, index) => {
        return (
          <div key={item.id}>
            <input
              aria-label={`test.${index}.firstName`}
              {...register(`test.${index}.firstName` as const)}
            />
            <NestedArray control={control} index={index} />
          </div>
        );
      })}

      <hr />

      <button
        id="append"
        type="button"
        onClick={() => append({ firstName: 'append' })}
      >
        append
      </button>

      <button
        id="prepend"
        type="button"
        onClick={() => prepend({ firstName: 'prepend' })}
      >
        prepend
      </button>

      <button
        id="update"
        onClick={() =>
          update(0, {
            firstName: 'BillUpdate',
          })
        }
        type="button"
      >
        update
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
        onClick={() => insert(1, { firstName: 'insert' })}
      >
        insert
      </button>

      <button id="remove" type="button" onClick={() => remove(1)}>
        remove
      </button>

      <button id="removeAll" type="button" onClick={() => remove()}>
        remove all
      </button>

      <button
        id="setValue"
        type={'button'}
        onClick={() =>
          setValue('test', [
            {
              firstName: 'test',
              lastName: 'test',
              keyValue: [
                {
                  name: 'test',
                },
              ],
            },
            {
              firstName: 'test1',
              lastName: 'test',
              keyValue: [
                {
                  name: 'test',
                },
              ],
            },
            {
              firstName: 'test2',
              lastName: 'test',
              keyValue: [
                {
                  name: 'test',
                },
              ],
            },
          ])
        }
      >
        setValue
      </button>

      <button
        id="reset"
        type="button"
        onClick={() => {
          reset({
            test: [
              { firstName: 'test' },
              { firstName: 'test1' },
              { firstName: 'test2' },
            ],
          });
        }}
      >
        reset
      </button>

      <div id="count">{renderCountRef.current}</div>

      <p id="result">{JSON.stringify(result)}</p>

      <button id={'submit'}>Submit</button>
    </form>
  );
};
