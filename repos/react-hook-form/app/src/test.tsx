import React from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { Control } from '../../src/types';

type FormData = {
  nest: {
    test: {
      value: string;
      nestedArray: {
        value: string;
      }[];
    }[];
  };
};
const ChildComponent = ({
  index,
  control,
}: {
  control: Control<FormData>;
  index: number;
}) => {
  const { fields } = useFieldArray<FormData>({
    name: `nest.test.${index}.nestedArray` as const,
    control,
  });

  return (
    <div>
      {fields.map((item, i) => (
        <input
          key={item.id}
          {...control.register(
            `nest.test.${index}.nestedArray.${i}.value` as const,
          )}
        />
      ))}
    </div>
  );
};

const Component = () => {
  const { register, control } = useForm({
    defaultValues: {
      nest: {
        test: [
          { value: '1', nestedArray: [{ value: '2' }] },
          { value: '3', nestedArray: [{ value: '4' }] },
        ],
      },
    },
  });
  const { fields, remove, append } = useFieldArray({
    name: 'nest.test',
    control,
  });

  return (
    <div>
      {fields.map((item, i) => (
        <div key={item.id}>
          <input {...register(`nest.test.${i}.value` as const)} />

          <ChildComponent control={control} index={i} />

          <button
            type={'button'}
            onClick={() => remove(i)}
            data-testid={item.value}
          >
            remove
          </button>
        </div>
      ))}

      <button type={'button'} onClick={() => append({ value: 'test' })}>
        append
      </button>
    </div>
  );
};

export default Component;
