import React from 'react';
import ReactDOM from 'react-dom';
import { useForm } from 'react-hook-form';

export default function App() {
  const {
    register,
    formState: { errors },
    handleSubmit,
  } = useForm();
  const onSubmit = (data) => {
    alert(JSON.stringify(data));
  };

  return (
    <div className="App">
      <form onSubmit={handleSubmit(onSubmit)}>
        <label htmlFor="firstName">First Name</label>
        <input
          placeholder="Bill"
          {...register('firstName', {
            required: 'this is a required',
            maxLength: {
              value: 2,
              message: 'Max length is 2',
            },
          })}
        />
        <br />
        {errors.firstName && errors.firstName.message}
        <br />

        <label htmlFor="lastName">Last Name</label>
        <input
          placeholder="Luo"
          {...register('lastName', {
            required: 'this is required',
            minLength: {
              value: 2,
              message: 'Min length is 2',
            },
          })}
        />
        <br />
        {errors.lastName && errors.lastName.message}
        <br />

        <label htmlFor="email">Email</label>
        <input
          placeholder="bluebill1049@hotmail.com"
          type="text"
          {...register('email', {
            required: 'this is required',
            pattern: {
              value:
                /^[a-zA-Z0-9.!#$%&’*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/,
              message: 'Invalid email address',
            },
          })}
        />
        <br />
        {errors.email && errors.email.message}
        <br />
        <button type="submit">Submit</button>
      </form>
    </div>
  );
}
