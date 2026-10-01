import React from 'react';
import { useForm } from 'react-hook-form';

export default function App() {
  const {
    register,
    formState: { errors },
    trigger,
    handleSubmit,
  } = useForm();

  console.log('errors', errors);

  return (
    <form onSubmit={handleSubmit((data) => console.log(data))}>
      <h1>validationField</h1>
      <label>First name: </label>
      <input {...register('firstName', { required: true })} />

      <label>Last name: </label>
      <input {...register('lastName', { required: true })} />

      <button
        type="button"
        onClick={async () => {
          const result = await trigger(['firstName', 'lastName']);
          if (result) {
            console.log('Valid input');
          }
        }}
      >
        Trigger
      </button>
    </form>
  );
}
