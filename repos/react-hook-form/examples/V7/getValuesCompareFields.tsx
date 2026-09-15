import React from 'react';
import ReactDOM from 'react-dom';
import { useForm } from 'react-hook-form';

export default function App() {
  const {
    register,
    formState: { errors },
    getValues,
    handleSubmit,
  } = useForm();

  return (
    <div className="App">
      <h1>getValue - Compare Field Values</h1>
      <form onSubmit={handleSubmit((data) => console.log(data))}>
        <label>New Password: </label>
        <input
          name="password"
          ref={register({ required: 'Password is required!' })}
        />
        {errors.password && (
          <p style={{ color: 'white' }}>{errors.password.message}</p>
        )}

        <label>Confirm Password: </label>
        <input
          name="passwordConfirmation"
          ref={register({
            required: 'Please confirm password!',
            validate: {
              matchesPreviousPassword: (value) => {
                const { password } = getValues();
                return password === value || 'Passwords should match!';
              },
            },
          })}
        />
        {errors.passwordConfirmation && (
          <p style={{ color: 'white' }}>
            {errors.passwordConfirmation.message}
          </p>
        )}

        <button type="submit">Trigger</button>
      </form>
    </div>
  );
}
