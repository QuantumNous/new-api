import React from 'react';
import { useForm } from 'react-hook-form';

export default function App() {
  const { register, errors, trigger } = useForm();

  console.log('errors', errors);

  return (
    <div className="App">
      <h1>validationField</h1>
      <label>First name: </label>
      <input name="firstName" ref={register({ required: true })} />

      <label>Last name: </label>
      <input name="lastName" ref={register({ required: true })} />

      <button
        type="button"
        onClick={async () => {
          const result = await trigger(['firstName', 'lastName']);
          if (result) {
            console.log('Valid input');
          }
        }}
      >
        Trigger
      </button>
    </div>
  );
}
