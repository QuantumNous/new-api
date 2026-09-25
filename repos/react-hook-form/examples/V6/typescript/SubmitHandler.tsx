import React from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';

type FormValues = {
  firstName: string;
  lastName: string;
  email: string;
};

export default function App() {
  const { register, handleSubmit } = useForm<FormValues>();
  const onSubmit: SubmitHandler<FormValues> = (data) =>
    alert(JSON.stringify(data));

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div>
        <label>First Name</label>
        <input name="firstName" ref={register} />
      </div>

      <div>
        <label>Last Name</label>
        <input name="lastName" ref={register} />
      </div>

      <div>
        <label htmlFor="email">Email</label>
        <input name="email" type="email" ref={register} />
      </div>

      <input type="submit" />
    </form>
  );
}
