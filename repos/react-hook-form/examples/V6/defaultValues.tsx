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
          <input name="firstName" placeholder="bill" ref={register} />
        </div>

        <div>
          <label htmlFor="lastName">Last Name</label>
          <input name="lastName" placeholder="luo" ref={register} />
        </div>

        <div>
          <label htmlFor="email">Email</label>
          <input
            name="email"
            placeholder="bluebill1049@hotmail.com"
            type="email"
            ref={register}
          />
        </div>

        <div>
          <label>Is developer?</label>
          <input name="isDeveloper" type="checkbox" ref={register} />
        </div>
        <button type="submit">Submit</button>
      </form>
    </div>
  );
}
