import React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';

export default function UseFieldArraySimpleExample() {
  const { register, control, handleSubmit } = useForm({
    defaultValues: {
      users: [{ name: '' }],
    },
  });

  const { fields, append } = useFieldArray({
    control,
    name: 'users',
  });

  const onSubmit = (data) => console.log(data);

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {fields.map((field, index) => (
        <input
          key={field.id}
          {...register(`users.${index}.name`)}
          placeholder={`User ${index + 1}`}
        />
      ))}
      <button type="button" onClick={() => append({ name: '' })}>
        Add User
      </button>
      <input type="submit" />
    </form>
  );
}
