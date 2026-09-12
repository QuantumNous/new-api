import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useForm } from 'react-hook-form';

export default function App() {
  const { register, handleSubmit, reset } = useForm({
    mode: 'onChange',
  });
  const onSubmit = (data, e) => {
    e.target.reset(); // reset after form submit
    alert(JSON.stringify(data));
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div>
        <label>First name</label>
        <input type="text" ref={register('firstName', { required: true })} />
      </div>
      <div>
        <label>Last name</label>
        <input type="text" {...register('lastName')} />
      </div>
      <div>
        <label>Email</label>
        <input type="text" {...register('email')} />
      </div>
      <div>
        <label>Mobile number</label>
        <input type="tel" {...register('mobileNumber')} />
      </div>
      <div>
        <label>Title</label>
        <select {...register('title')}>
          <option value="Mr">Mr</option>
          <option value="Mrs">Mrs</option>
          <option value="Miss">Miss</option>
          <option value="Dr">Dr</option>
        </select>
      </div>

      <div>
        <label>Are you a developer?</label>
        <input type="radio" value="Yes" {...register('developer')} />
        <input type="radio" value="No" {...register('developer')} />
      </div>

      <input type="submit" />
      <input
        style={{ display: 'block', marginTop: 20 }}
        type="reset"
        value="Standard Reset Field Values"
      />
      <input
        style={{ display: 'block', marginTop: 20 }}
        type="reset"
        onClick={reset}
        value="Custom Reset Field Values & Errors"
      />
    </form>
  );
}
