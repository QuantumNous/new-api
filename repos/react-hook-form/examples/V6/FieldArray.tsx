import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { useForm } from 'react-hook-form';

function createArrayWithNumbers(length) {
  return Array.from({ length }, (_, k) => k);
}

export default function App() {
  const { register, handleSubmit, errors } = useForm();
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
                <label htmlFor="firstName">First Name</label>
                <input
                  name={`firstName[${number}]`}
                  placeholder="first name"
                  ref={register({ required: true })}
                />
              </div>

              <div>
                <label htmlFor="lastName">Last Name</label>
                <input
                  name={`lastName[${number}]`}
                  placeholder="last name"
                  ref={register({ required: true })}
                />
              </div>

              <div>
                <label htmlFor="email">Email</label>
                <input
                  name={`email[${number}]`}
                  placeholder="email"
                  ref={register({ required: true })}
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
