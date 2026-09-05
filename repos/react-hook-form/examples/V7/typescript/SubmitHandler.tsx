import React from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';

type FormValues = {
  firstName: string;
  lastName: string;
  email: string;
};

export default function App() {
  const { register, handleSubmit } = useForm<FormValues>();
  const onSubmit: SubmitHandler<FormValues> = (data) =>
    alert(JSON.stringify(data));

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div>
        <label>First Name</label>
        <input {...register('firstName')} />
      </div>

      <div>
        <label>Last Name</label>
        <input {...register('lastName')} />
      </div>

      <div>
        <label htmlFor="email">Email</label>
        <input type="email" {...register('email')} />
      </div>

      <input type="submit" />
    </form>
  );
}
