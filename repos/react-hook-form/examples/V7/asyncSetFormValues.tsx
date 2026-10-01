import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useForm } from 'react-hook-form';

export default function App() {
  const { register, handleSubmit, reset } = useForm();
  const onSubmit = (data) => {
    alert(JSON.stringify(data));
  };

  useEffect(() => {
    // you can use `async` server requests to populate your form!
    setTimeout(() => {
      reset({
        firstName: 'bill',
        lastName: 'luo',
      });
    }, 2000);
  }, [reset]);

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <h1>Async Set Form Values</h1>
      <label>First name</label>
      <input {...register('firstName')} />

      <label>Last name</label>
      <input {...register('lastName')} />
      <input type="submit" />
    </form>
  );
}
