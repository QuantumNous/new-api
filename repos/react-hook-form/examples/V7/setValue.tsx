import React from 'react';
import ReactDOM from 'react-dom';
import { useForm } from 'react-hook-form';

export default function App() {
  const { register, handleSubmit, setValue } = useForm();
  const onSubmit = (data) => {
    alert(JSON.stringify(data));
  };

  return (
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

      <div>
        <label>Age group</label>
        <select {...register('ageGroup')}>
          <option value="0">0 - 1</option>
          <option value="1">1 - 100</option>
        </select>
      </div>
      <button
        type="button"
        onClick={() => {
          setValue('firstName', 'Set value by action');
          setValue('ageGroup', '1');
          setValue('isDeveloper', true);
        }}
      >
        Set All Values
      </button>
      <button type="submit">Submit</button>
    </form>
  );
}
