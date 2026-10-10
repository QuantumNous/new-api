import React from 'react';
import ReactDOM from 'react-dom';
import { useForm } from 'react-hook-form';

export default function App() {
  const { register, watch, handleSubmit } = useForm();
  const onSubmit = (data) => {
    alert(JSON.stringify(data));
  };

  const moreDetail = watch('moreDetail');

  return (
    <div className="App">
      <form onSubmit={handleSubmit(onSubmit)}>
        <div>
          <label htmlFor="firstName">First Name</label>
          <input placeholder="Bill" {...register('firstName')} />
        </div>

        <div>
          <label htmlFor="lastName">Last Name</label>
          <input placeholder="Luo" {...register('lastName')} />
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
          <label htmlFor="lastName">More Details</label>
          <input type="checkbox" {...register('moreDetail')} />
        </div>

        {moreDetail && (
          <div>
            <label>Interests</label>
            <input type="text" {...register('interests')} />
          </div>
        )}
        <button type="submit">Submit</button>
      </form>
    </div>
  );
}
