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
      <form>
        <div>
          <label htmlFor="firstName">First Name</label>
          <input {...register('firstName')} placeholder="bill" />
        </div>

        <div>
          <label htmlFor="lastName">Last Name</label>
          <input {...register('lastName')} placeholder="luo" />
        </div>

        <div>
          <label htmlFor="email">Email</label>
          <input
            {...register('email')}
            placeholder="bluebill1049@hotmail.com"
            type="email"
          />
        </div>
      </form>

      <button type="button" onClick={handleSubmit(onSubmit)}>
        submit button outside of form
      </button>
    </div>
  );
}
