import React from 'react';
import ReactDOM from 'react-dom';
import { useForm } from 'react-hook-form';

export default function App() {
  const { register, errors, handleSubmit } = useForm({
    mode: 'onChange',
  });
  const onSubmit = (data) => {
    alert(JSON.stringify(data));
  };

  return (
    <div className="App">
      <form onSubmit={handleSubmit(onSubmit)}>
        <div>
          <label htmlFor="firstName">First Name</label>
          <input
            name="firstName"
            placeholder="bill"
            ref={register({ required: true })}
          />
          {errors.firstName && 'This is required'}
        </div>

        <div>
          <label htmlFor="lastName">Last Name</label>
          <input
            name="lastName"
            placeholder="luo"
            ref={register({ required: true })}
          />
          {errors.lastName && 'This is required'}
        </div>

        <div>
          <label htmlFor="email" placeholder="bluebill1049@hotmail.com">
            Email
          </label>
          <input name="email" ref={register({ required: true })} />
          {errors.email && 'This is required'}
        </div>
        <button type="submit">Submit</button>
      </form>
    </div>
  );
}
