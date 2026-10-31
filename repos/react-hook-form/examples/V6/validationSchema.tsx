import React from 'react';
import ReactDOM from 'react-dom';
import { useForm } from 'react-hook-form';
import * as yup from 'yup'; // you will have to install yup

const SignupSchema = yup.object().shape({
  firstName: yup.string().required(),
  age: yup.number().required().positive().integer(),
  website: yup.string().url(),
});

export default function App() {
  const { register, handleSubmit, errors } = useForm({
    validationSchema: SignupSchema,
  });
  const onSubmit = (data) => {
    alert(JSON.stringify(data));
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div>
        <label>Develop?</label>
        Yes
        <input type="radio" name="test" value="yes" ref={register} />
        No
        <input type="radio" name="test" value="no" ref={register} />
      </div>
      <div>
        <label>First Name</label>
        <input type="text" name="firstName" ref={register} />
      </div>
      <div>
        <label>Last Name</label>
        <input type="text" name="lastName" ref={register} />
      </div>
      <div>
        <label>Age</label>
        <input type="text" name="age" ref={register} />
      </div>
      <div>
        <label>Website</label>
        <input type="text" name="website" ref={register} />
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
