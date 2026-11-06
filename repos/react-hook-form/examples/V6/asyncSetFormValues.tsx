import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useForm } from 'react-hook-form';

export default function App() {
  const { register, handleSubmit, reset } = useForm();
  const onSubmit = (data) => {
    alert(JSON.stringify(data));
  };

  useEffect(() => {
    // you can do async server request and fill up form
    setTimeout(() => {
      reset({
        firstName: 'bill',
        lastName: 'luo',
      });
    }, 2000);
  }, [reset]);

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <h1>Async Set Form Values</h1>
      <label>First name</label>
      <input name="firstName" ref={register} />

      <label>Last name</label>
      <input name="lastName" ref={register} />
      <input type="submit" />
    </form>
  );
}
