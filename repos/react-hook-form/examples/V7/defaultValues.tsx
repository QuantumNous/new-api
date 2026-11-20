import React from 'react';
import ReactDOM from 'react-dom';
import { useForm } from 'react-hook-form';

export default function App() {
  const { register, handleSubmit } = useForm({
    defaultValues: {
      firstName: 'bill',
      lastName: 'luo',
      email: 'test@test.com',
      isDeveloper: true,
    },
  });
  const onSubmit = (data) => {
    alert(JSON.stringify(data));
  };

  return (
    <div className="App">
      <form onSubmit={handleSubmit(onSubmit)}>
        <div>
          <label htmlFor="firstName">First Name</label>
          <input placeholder="bill" {...register('firstName')} />
        </div>

        <div>
          <label htmlFor="lastName">Last Name</label>
          <input placeholder="luo" {...register('lastName')} />
        </div>

        <div>
          <label htmlFor="email">Email</label>
          <input
            placeholder="bluebill1049@hotmail.com"
            type="email"
            {...register('email')}
          />
        </div>

        <div>
          <label>Is developer?</label>
          <input type="checkbox" {...register('isDeveloper')} />
        </div>
        <button type="submit">Submit</button>
      </form>
    </div>
  );
}
