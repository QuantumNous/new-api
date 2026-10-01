import React from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { useParams } from 'react-router-dom';

let renderCount = 0;

type FormValues = { data: { name: string }[] };

const UseFieldArray: React.FC = () => {
  const { mode } = useParams();
  const withoutFocus: boolean = mode === 'defaultAndWithoutFocus';
  const {
    control,
    handleSubmit,
    register,
    formState: { isDirty, touchedFields, isValid, dirtyFields, errors },
    reset,
  } = useForm<FormValues>({
    ...(mode === 'default' || withoutFocus
      ? {
          defaultValues: {
            data: [{ name: 'test' }, { name: 'test1' }, { name: 'test2' }],
          },
        }
      : {}),
    mode: mode === 'formState' ? 'onChange' : 'onSubmit',
  });
  const {
    fields,
    append,
    prepend,
    swap,
    move,
    insert,
    remove,
    update,
    replace,
  } = useFieldArray({
    control,
    name: 'data',
  });
  const [data, setData] = React.useState<FormValues>();
  const onSubmit = (data: FormValues) => {
    setData(data);
  };

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
            {index % 2 ? (
              <input
                id={`field${index}`}
                data-order={index}
                {...register(`data.${index}.name` as const, {
                  required: 'This is required',
                })}
              />
            ) : (
              <Controller
                render={({ field }) => (
                  <input id={`field${index}`} {...field} />
                )}
                control={control}
                rules={{
                  required: 'This is required',
                }}
                name={`data.${index}.name`}
                data-order={index}
              />
            )}
            {errors.data?.[index]?.name && (
              <p id={`error${index}`}>{errors.data[index]!.name!.message}</p>
            )}
            <button id={`delete${index}`} onClick={() => remove(index)}>
              Delete
            </button>
          </li>
        ))}
      </ul>

      <button
        id="append"
        type="button"
        onClick={() =>
          append(
            { name: renderCount.toString() },
            {
              shouldFocus: !withoutFocus,
            },
          )
        }
      >
        append
      </button>

      <button
        id="prepend"
        type="button"
        onClick={() =>
          prepend(
            { name: renderCount.toString() },
            {
              shouldFocus: !withoutFocus,
            },
          )
        }
      >
        prepend
      </button>

      <button id="swap" onClick={() => swap(1, 2)} type="button">
        swap
      </button>

      <button id="move" onClick={() => move(2, 0)} type="button">
        move
      </button>

      <button
        id="update"
        onClick={() =>
          update(0, {
            name: 'changed',
          })
        }
        type="button"
      >
        update
      </button>

      <button
        id="updateRevert"
        onClick={() =>
          update(0, {
            name: 'test',
          })
        }
        type="button"
      >
        update revert
      </button>

      <button
        id="insert"
        type="button"
        onClick={() =>
          insert(
            1,
            { name: renderCount.toString() },
            {
              shouldFocus: !withoutFocus,
            },
          )
        }
      >
        insert
      </button>

      <button id="remove" type="button" onClick={() => remove(1)}>
        remove
      </button>

      <button
        id="removeAsync"
        type="button"
        onClick={() =>
          setTimeout(() => {
            remove(1);
          }, 90)
        }
      >
        remove async
      </button>

      <button
        id="appendAsync"
        type="button"
        onClick={() =>
          setTimeout(() => {
            append({
              name: 'appendAsync',
            });
          }, 90)
        }
      >
        append async
      </button>

      <button
        id="prependAsync"
        type="button"
        onClick={() =>
          setTimeout(() => {
            prepend({
              name: 'prependAsync',
            });
          }, 90)
        }
      >
        prepend async
      </button>

      <button
        id="insertAsync"
        type="button"
        onClick={() =>
          setTimeout(() => {
            insert(1, {
              name: 'insertAsync',
            });
          }, 90)
        }
      >
        insert async
      </button>

      <button
        id="swapAsync"
        type="button"
        onClick={() =>
          setTimeout(() => {
            swap(0, 1);
          }, 90)
        }
      >
        swap async
      </button>

      <button id="moveAsync" onClick={() => move(1, 0)} type="button">
        move async
      </button>

      <button
        id="updateAsync"
        onClick={() =>
          setTimeout(() => {
            update(0, {
              name: 'updateAsync',
            });
          }, 90)
        }
        type="button"
      >
        update async
      </button>

      <button
        id="replaceAsync"
        type="button"
        onClick={() =>
          setTimeout(() => {
            replace([
              { name: `${renderCount}. lorem` },
              { name: `${renderCount}. ipsum` },
              { name: `${renderCount}. dolor` },
              { name: `${renderCount}. sit amet` },
            ]);
          }, 90)
        }
      >
        replace async
      </button>

      <button id="removeAll" type="button" onClick={() => remove()}>
        remove all
      </button>

      <button
        id="replace"
        type="button"
        onClick={() =>
          replace([
            { name: `${renderCount}. lorem` },
            { name: `${renderCount}. ipsum` },
            { name: `${renderCount}. dolor` },
            { name: `${renderCount}. sit amet` },
          ])
        }
      >
        replace
      </button>

      <button
        id="reset"
        type="button"
        onClick={() => {
          reset({
            data: [{ name: 'test' }, { name: 'test1' }, { name: 'test2' }],
          });
        }}
      >
        reset
      </button>

      <button
        id="resetAsync"
        type="button"
        onClick={() => {
          setTimeout(() => {
            reset({
              data: [],
            });
          }, 100);
        }}
      >
        reset async
      </button>

      <button id="submit">Submit</button>

      <div id="renderCount">{renderCount}</div>
      <div id="result">{JSON.stringify(data)}</div>
      <section>
        Dirty:
        <div id="dirty">{isDirty ? 'yes' : 'no'}</div>
      </section>
      <section>
        isValid:
        <div id="isValid">{isValid ? 'yes' : 'no'}</div>
      </section>
      <div id="dirtyFields">{JSON.stringify(dirtyFields)}</div>
      <div id="touched">{JSON.stringify(touchedFields.data)}</div>
    </form>
  );
};

export default UseFieldArray;
