import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { useForm } from 'react-hook-form';

function createArrayWithNumbers(length) {
  return Array.from({ length }, (_, i) => i);
}

export default function App() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();
  const [size, setSize] = useState(1);
  const onSubmit = (data) => {
    alert(JSON.stringify(data));
  };

  console.log(errors);

  return (
    <div className="App">
      <form onSubmit={handleSubmit(onSubmit)}>
        {createArrayWithNumbers(size).map((number) => {
          return (
            <div key={number}>
              <div>
                <label htmlFor={`firstName.${number}`}>First Name</label>
                <input
                  id={`firstName.${number}`}
                  placeholder="first name"
                  {...register(`firstName.${number}`, { required: true })}
                />
              </div>

              <div>
                <label htmlFor={`lastName.${number}`}>Last Name</label>
                <input
                  id={`firstName.${number}`}
                  placeholder="last name"
                  {...register(`lastName.${number}`, { required: true })}
                />
              </div>

              <div>
                <label htmlFor={`email.${number}`}>Email</label>
                <input
                  id={`email.${number}`}
                  placeholder="email"
                  {...register(`email.${number}`, { required: true })}
                />
              </div>

              <hr />
            </div>
          );
        })}

        <button type="button" onClick={() => setSize(size + 1)}>
          Add Person
        </button>
        <br />
        <div style={{ color: 'red' }}>
          {Object.keys(errors).length > 0 &&
            'There are errors, check your console.'}
        </div>
        <button type="submit">Submit</button>
      </form>
    </div>
  );
}
