import React from 'react';
import { useForm, Resolver } from 'react-hook-form';

type FormValues = {
  firstName: string;
  lastName: string;
};

const resolver: Resolver<FormValues> = async (values) => {
  return {
    values: !values.firstName ? {} : values,
    errors: !values.firstName
      ? {
          firstName: {
            type: 'required',
            message: 'This is required.',
          },
        }
      : {},
  };
};

export default function App() {
  const { register, handleSubmit, errors } = useForm<FormValues>({
    resolver: resolver,
  });
  const onSubmit = handleSubmit((data) => alert(JSON.stringify(data)));

  return (
    <form onSubmit={onSubmit}>
      <div>
        <label>First Name</label>
        <input {...register('firstName')} />
        {errors?.firstName && <p>{errors.firstName.message}</p>}
      </div>

      <div>
        <label>Last Name</label>
        <input {...register('lastName')} />
      </div>

      <input type="submit" />
    </form>
  );
}
