import React from 'react';
import ReactDOM from 'react-dom';
import { useForm } from 'react-hook-form';

export default function App() {
  const { register, handleSubmit, errors } = useForm();
  const onSubmit = (data) => {
    alert(JSON.stringify(data));
  };
  const initialValues = {
    firstName: 'bill',
    lastName: 'luo',
    email: 'bluebill1049@hotmail.com',
    age: -1,
  };

  return (
    <div className="App">
      <form onSubmit={handleSubmit(onSubmit)}>
        <div>
          <label htmlFor="firstName">First Name</label>
          <input
            defaultValue={initialValues.firstName}
            name="firstName"
            placeholder="bill"
            ref={register({
              validate: (value) => value !== 'bill',
            })}
          />
        </div>
        {errors.firstName && <p>Your name is not bill</p>}

        <div>
          <label htmlFor="lastName">Last Name</label>
          <input
            defaultValue={initialValues.lastName}
            name="lastName"
            placeholder="luo"
            ref={register({
              validate: (value) => value.length > 3,
            })}
          />
        </div>
        {errors.lastName && <p>Your last name is less than 3 characters</p>}

        <div>
          <label htmlFor="email">Email</label>
          <input
            defaultValue={initialValues.email}
            name="email"
            placeholder="bluebill1049@hotmail.com"
            type="email"
            ref={register}
          />
        </div>

        <div>
          <label htmlFor="age">Age</label>
          <input
            defaultValue={initialValues.age}
            name="age"
            placeholder="0"
            type="text"
            ref={register({
              validate: {
                positiveNumber: (value) => parseFloat(value) > 0,
                lessThanHundred: (value) => parseFloat(value) <= 150,
              },
            })}
          />
        </div>
        {errors.age && errors.age.type === 'positiveNumber' && (
          <p>Your age is invalid</p>
        )}
        {errors.age && errors.age.type === 'lessThanHundred' && (
          <p>
            Your age is higher than 150. No one is that old, are you a vampire?
          </p>
        )}

        <button type="submit">Submit</button>
      </form>
    </div>
  );
}
