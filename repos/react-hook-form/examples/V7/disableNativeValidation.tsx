import React from 'react';
import { useForm } from 'react-hook-form';

export default function App() {
  const {
    formState: { errors },
    handleSubmit,
    register,
  } = useForm();

  const onSubmit = (data) => {
    console.log({ data });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <label htmlFor="email">Email</label>
      <input
        name="email"
        type="email"
        ref={register({
          required: 'Email is required',
          validate: (value) =>
            value.includes('@') || "Email must include '@' symbol",
        })}
      />
      {errors.email && errors.email.message}
      <input type="submit" />
    </form>
  );
}
