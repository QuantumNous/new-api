import React from 'react';
import ReactDOM from 'react-dom';
import { useForm } from 'react-hook-form';

export default function App() {
  const { register, handleSubmit } = useForm();
  const onSubmit = (data) => {
    alert(JSON.stringify(data));
  };

  return (
    <div className="App">
      <form onSubmit={handleSubmit(onSubmit)}>
        <div>
          <label htmlFor="firstName">First Name</label>
          <input id="firstName" placeholder="bill" {...register('firstName')} />
        </div>

        <div>
          <label htmlFor="lastName">Last Name</label>
          <input id="lastName" placeholder="luo" {...register('lastName')} />
        </div>

        <div>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            placeholder="bluebill1049@hotmail.com"
            type="email"
            {...register('email')}
          />
        </div>
        <button type="submit">Submit</button>
      </form>
    </div>
  );
}
