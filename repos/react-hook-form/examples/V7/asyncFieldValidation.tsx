import React from 'react';
import ReactDOM from 'react-dom';
import { useForm } from 'react-hook-form';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default function App() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();
  const onSubmit = (data) => {
    alert(JSON.stringify(data));
  };

  console.log(errors);

  return (
    <div className="App">
      <form onSubmit={handleSubmit(onSubmit)}>
        <div>
          <label htmlFor="username">User Name</label>
          <input
            id="username"
            placeholder="Bill"
            {...register('username', {
              validate: async (value) => {
                await sleep(3000);
                return value === 'bill';
              },
            })}
          />
        </div>

        <div>
          <label htmlFor="lastName">Last Name</label>
          <input id="lastName" placeholder="Luo" {...register('lastName')} />
        </div>

        <div>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            placeholder="bluebill1049@hotmail.com"
            type="text"
            {...register('email')}
          />
        </div>

        <div style={{ color: 'red' }}>
          {Object.keys(errors).length > 0 &&
            'There are errors, check your console.'}
        </div>
        <button type="submit">Submit</button>
      </form>
    </div>
  );
}
