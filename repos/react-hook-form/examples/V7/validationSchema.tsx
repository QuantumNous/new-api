import React from 'react';
import { useForm } from 'react-hook-form';
import * as yup from 'yup'; // you will have to install yup
import { yupResolver } from '@hookform/resolvers/yup'; // you will have to install @hookform/resolvers

const SignupSchema = yup.object().shape({
  firstName: yup.string().required(),
  age: yup.number().required().positive().integer(),
  website: yup.string().url(),
});

export default function App() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(SignupSchema),
  });
  const onSubmit = (data) => {
    alert(JSON.stringify(data));
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div>
        <label>Are you a Developer?</label>
        Yes
        <input type="radio" {...register('test')} value="yes" />
        No
        <input type="radio" {...register('test')} value="no" />
      </div>
      <div>
        <label>First Name</label>
        <input type="text" {...register('firstName')} />
      </div>
      <div>
        <label>Last Name</label>
        <input type="text" {...register('lastName')} />
      </div>
      <div>
        <label>Age</label>
        <input type="text" {...register('age')} />
      </div>
      <div>
        <label>Website</label>
        <input type="text" {...register('website')} />
      </div>

      <div style={{ color: 'red' }}>
        <pre>
          {Object.keys(errors).length > 0 && (
            <label>Errors: {JSON.stringify(errors, null, 2)}</label>
          )}
        </pre>
      </div>
      <input type="submit" />
    </form>
  );
}
